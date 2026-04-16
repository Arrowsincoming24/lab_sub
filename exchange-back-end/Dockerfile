# Watermark: Aarav Joshi
FROM eclipse-temurin:11-jre-jammy

ENV APP_HOME=/opt/app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends tini \
	&& rm -rf /var/lib/apt/lists/* \
	&& mkdir -p $APP_HOME

WORKDIR $APP_HOME

COPY target/quarkus-app/lib/ ./lib/
COPY target/quarkus-app/*.jar ./
COPY target/quarkus-app/app/ ./app/
COPY target/quarkus-app/quarkus/ ./quarkus/

EXPOSE 8090

ENTRYPOINT ["tini", "--", "java", "-jar", "quarkus-run.jar"]
