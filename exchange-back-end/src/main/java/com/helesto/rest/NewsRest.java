// Watermark: Aarav Joshi
package com.helesto.rest;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;

import org.jboss.logging.Logger;

@Path("/api/news")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NewsRest {

    private static final Logger LOG = Logger.getLogger(NewsRest.class);

    private static final Duration CACHE_TTL = Duration.ofMinutes(2);
    private static final int DEFAULT_LIMIT = 20;

    private static final Pattern ITEM_PATTERN = Pattern.compile("<item>(.*?)</item>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_PATTERN = Pattern.compile("<title>(.*?)</title>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern DESC_PATTERN = Pattern.compile("<description>(.*?)</description>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern PUB_DATE_PATTERN = Pattern.compile("<pubDate>(.*?)</pubDate>", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    private static final List<FeedSource> FEED_SOURCES = List.of(
            new FeedSource("Reuters", "Markets", "https://feeds.reuters.com/reuters/businessNews"),
            new FeedSource("CNBC", "Markets", "https://www.cnbc.com/id/100003114/device/rss/rss.html")
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private volatile List<NewsItemDto> cachedNews = List.of();
    private volatile Instant cacheExpiry = Instant.EPOCH;

    @GET
    public List<NewsItemDto> getNews(@QueryParam("limit") Integer limitParam) {
        final int limit = sanitizeLimit(limitParam);
        if (Instant.now().isBefore(cacheExpiry) && !cachedNews.isEmpty()) {
            return slice(cachedNews, limit);
        }

        synchronized (this) {
            if (Instant.now().isBefore(cacheExpiry) && !cachedNews.isEmpty()) {
                return slice(cachedNews, limit);
            }

            List<NewsItemDto> refreshed = fetchAllFeeds(limit * 2);
            if (!refreshed.isEmpty()) {
                cachedNews = refreshed;
                cacheExpiry = Instant.now().plus(CACHE_TTL);
                return slice(refreshed, limit);
            }

            if (!cachedNews.isEmpty()) {
                cacheExpiry = Instant.now().plus(Duration.ofSeconds(30));
                return slice(cachedNews, limit);
            }

            List<NewsItemDto> fallback = buildFallbackNews();
            cachedNews = fallback;
            cacheExpiry = Instant.now().plus(Duration.ofMinutes(1));
            return slice(fallback, limit);
        }
    }

    private List<NewsItemDto> fetchAllFeeds(int maxItems) {
        List<NewsItemDto> merged = new ArrayList<>();
        for (FeedSource source : FEED_SOURCES) {
            merged.addAll(fetchFeed(source, maxItems));
        }

        merged.sort(Comparator.comparing(NewsItemDto::getTimestamp).reversed());

        if (merged.size() > maxItems) {
            return new ArrayList<>(merged.subList(0, maxItems));
        }
        return merged;
    }

    private List<NewsItemDto> fetchFeed(FeedSource source, int maxItems) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(source.url))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", "fix-trading-simulator-news-fetcher/1.0")
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warnf("News feed fetch failed for %s: HTTP %d", source.url, response.statusCode());
                return Collections.emptyList();
            }
            return parseRss(source, response.body(), maxItems);
        } catch (InterruptedException ex) {
            LOG.warnf("News feed fetch interrupted for %s: %s", source.url, ex.getMessage());
            Thread.currentThread().interrupt();
            return Collections.emptyList();
        } catch (IOException ex) {
            LOG.warnf("News feed fetch error for %s: %s", source.url, ex.getMessage());
            return Collections.emptyList();
        }
    }

    private List<NewsItemDto> parseRss(FeedSource source, String xml, int maxItems) {
        List<NewsItemDto> out = new ArrayList<>();
        Matcher itemMatcher = ITEM_PATTERN.matcher(xml);
        while (itemMatcher.find() && out.size() < maxItems) {
            String itemXml = itemMatcher.group(1);
            String title = clean(extractFirst(TITLE_PATTERN, itemXml));
            if (title.isBlank()) {
                continue;
            }
            String summary = clean(extractFirst(DESC_PATTERN, itemXml));
            Instant timestamp = parseRfcDate(extractFirst(PUB_DATE_PATTERN, itemXml));

            NewsItemDto dto = new NewsItemDto();
            dto.id = UUID.randomUUID().toString();
            dto.title = title;
            dto.summary = summary.isBlank() ? title : summary;
            dto.source = source.name;
            dto.category = source.category;
            dto.symbol = detectSymbol(title + " " + summary);
            dto.sentiment = detectSentiment(title + " " + summary);
            dto.timestamp = timestamp.toString();
            dto.isBreaking = title.toLowerCase(Locale.ROOT).contains("breaking");
            dto.impact = detectImpact(title + " " + summary);
            out.add(dto);
        }
        return out;
    }

    private String extractFirst(Pattern pattern, String input) {
        Matcher matcher = pattern.matcher(input);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String clean(String raw) {
        if (raw == null) {
            return "";
        }
        String noHtml = raw.replaceAll("<[^>]+>", " ");
        return unescapeXml(noHtml).replaceAll("\\s+", " ").trim();
    }

    private String unescapeXml(String input) {
        return input
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'");
    }

    private Instant parseRfcDate(String value) {
        if (value == null || value.isBlank()) {
            return Instant.now();
        }
        try {
            return OffsetDateTime.parse(value.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeParseException ex) {
            return Instant.now();
        }
    }

    private String detectSymbol(String text) {
        String upper = text.toUpperCase(Locale.ROOT);
        List<String> symbols = List.of("AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "NFLX", "JPM", "BAC", "XOM", "CVX", "WMT", "DIS");
        for (String symbol : symbols) {
            if (upper.contains(symbol)) {
                return symbol;
            }
        }
        return null;
    }

    private String detectSentiment(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, List.of("surge", "rally", "beats", "record", "gain", "up ", "rise", "strong"))) {
            return "positive";
        }
        if (containsAny(lower, List.of("drop", "falls", "slump", "misses", "down ", "decline", "weak", "loss"))) {
            return "negative";
        }
        return "neutral";
    }

    private String detectImpact(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (containsAny(lower, List.of("fed", "inflation", "rate", "earnings", "guidance", "breaking", "opec", "war", "recession"))) {
            return "high";
        }
        if (containsAny(lower, List.of("upgrade", "downgrade", "outlook", "shipment", "delivery", "expansion"))) {
            return "medium";
        }
        return "low";
    }

    private boolean containsAny(String text, List<String> tokens) {
        for (String token : tokens) {
            if (text.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private int sanitizeLimit(Integer limitParam) {
        if (limitParam == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(100, limitParam));
    }

    private List<NewsItemDto> slice(List<NewsItemDto> items, int limit) {
        if (items.size() <= limit) {
            return items;
        }
        return new ArrayList<>(items.subList(0, limit));
    }

    private List<NewsItemDto> buildFallbackNews() {
        Instant now = Instant.now();
        return List.of(
                fromFallback("Fed Signals Policy Flexibility", "Markets are monitoring policy commentary after softer inflation data.", "Bloomberg", "Economy", now.minusSeconds(900), "high", "neutral", null),
                fromFallback("Apple Shares Gain on Services Strength", "Analysts highlighted recurring revenue momentum from subscription products.", "Reuters", "Earnings", now.minusSeconds(1800), "medium", "positive", "AAPL"),
                fromFallback("Oil Edges Higher on Supply Concerns", "Energy markets reacted to fresh supply-side updates from major producers.", "CNBC", "Markets", now.minusSeconds(2700), "medium", "neutral", null)
        );
    }

    private NewsItemDto fromFallback(String title, String summary, String source, String category, Instant timestamp, String impact, String sentiment, String symbol) {
        NewsItemDto dto = new NewsItemDto();
        dto.id = UUID.randomUUID().toString();
        dto.title = title;
        dto.summary = summary;
        dto.source = source;
        dto.category = category;
        dto.symbol = symbol;
        dto.sentiment = sentiment;
        dto.timestamp = timestamp.toString();
        dto.isBreaking = false;
        dto.impact = impact;
        return dto;
    }

    private static class FeedSource {
        final String name;
        final String category;
        final String url;

        FeedSource(String name, String category, String url) {
            this.name = name;
            this.category = category;
            this.url = url;
        }
    }

    public static class NewsItemDto {
        public String id;
        public String title;
        public String summary;
        public String source;
        public String category;
        public String symbol;
        public String sentiment;
        public String timestamp;
        public boolean isBreaking;
        public String impact;

        public String getTimestamp() {
            return timestamp;
        }
    }
}
