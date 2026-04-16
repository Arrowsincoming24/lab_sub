// Watermark: Aarav Joshi
package com.helesto.core;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import javax.inject.Singleton;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import quickfix.ConfigError;
import quickfix.SessionSettings;

@Singleton
public class SessionSettingsFactory {

    private static final Logger LOG = LoggerFactory.getLogger(SessionSettingsFactory.class.getName());

    @ConfigProperty(name = "quickfix.port", defaultValue = "9876")
    int quickfixPort;

    @ConfigProperty(name = "quickfix.heartbeat", defaultValue = "30")
    int heartbeatInterval;

    public SessionSettingsFactory() {
        LOG.info("SessionSettingsFactory Constructor");
    }

    public SessionSettings getSessionSettings() throws ConfigError {
        LOG.info("getSessionSettings called - Exchange Acceptor mode");

        StringBuilder settings = new StringBuilder();
        settings.append("[DEFAULT]\n")
                .append("ConnectionType=acceptor\n")
                .append("StartTime=00:00:00\n")
                .append("EndTime=00:00:00\n")
                .append("HeartBtInt=").append(heartbeatInterval).append("\n")
                .append("ReconnectInterval=5\n")
                .append("SocketAcceptPort=").append(quickfixPort).append("\n")
                .append("FileStorePath=./runtime/data/exchange\n")
                .append("FileLogPath=./runtime/logs/exchange\n")
                .append("UseDataDictionary=Y\n")
                .append("DataDictionary=FIX44.xml\n")
                .append("ValidateUserDefinedFields=N\n")
                .append("ValidateFieldsOutOfOrder=N\n")
                .append("ValidateFieldsHaveValues=Y\n")
                .append("ValidateSequenceNumbers=N\n")
                .append("AllowUnknownMsgFields=Y\n")
                .append("RefreshOnLogon=Y\n")
                .append("ResetOnLogon=N\n")
                .append("ResetOnLogout=Y\n")
                .append("ResetOnDisconnect=N\n")
                .append("SendRedundantResendRequests=Y\n")
                .append("PersistMessages=Y\n")
                .append("LogonTimeout=30\n")
                .append("LogoutTimeout=5\n")
                .append("\n");

        // Named broker + minifix sessions
        String[] namedTargets = {"BROKER", "MINIFIX", "MINIFIXJ", "MINIFIX-J"};
        for (String target : namedTargets) {
            settings.append("[SESSION]\n")
                    .append("BeginString=FIX.4.4\n")
                    .append("SenderCompID=EXCHANGE\n")
                    .append("TargetCompID=").append(target).append("\n")
                    .append("SocketAcceptPort=").append(quickfixPort).append("\n")
                    .append("\n");
        }

        // Load-test user sessions USER_0000 .. USER_0099 (100 isolated FIX sessions)
        for (int i = 0; i < 100; i++) {
            String userId = String.format("USER_%04d", i);
            settings.append("[SESSION]\n")
                    .append("BeginString=FIX.4.4\n")
                    .append("SenderCompID=EXCHANGE\n")
                    .append("TargetCompID=").append(userId).append("\n")
                    .append("SocketAcceptPort=").append(quickfixPort).append("\n")
                    .append("\n");
        }

        LOG.info("Exchange Acceptor configured on port {} with BROKER, MINIFIX, MINIFIXJ, MINIFIX-J and USER_0000..USER_0099 sessions", quickfixPort);
        ByteArrayInputStream inputStream = new ByteArrayInputStream(settings.toString().getBytes(StandardCharsets.UTF_8));
        return new SessionSettings(inputStream);
    }
}
