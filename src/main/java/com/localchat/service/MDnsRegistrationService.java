package com.localchat.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;

import jakarta.annotation.PreDestroy;
import javax.jmdns.JmDNS;
import javax.jmdns.ServiceInfo;
import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class MDnsRegistrationService implements CommandLineRunner {

    private JmDNS jmdns;

    @Value("${server.port:8080}")
    private int serverPort;

    @Override
    public void run(String... args) {
        log.info("Initializing LAN Discovery & mDNS Fallback Protocol...");
        
        InetAddress activeHost = getActiveLanIp();
        
        if (activeHost != null) {
            String directUrl = "http://" + activeHost.getHostAddress() + ":" + serverPort;
            log.info("=========================================================");
            log.info("Direct LAN Access: {}", directUrl);
            log.info("=========================================================");
            
            try {
                printAsciiQrCode(directUrl);
            } catch (Exception e) {
                log.warn("Failed to generate ASCII QR code", e);
            }

            // Register mDNS
            try {
                jmdns = JmDNS.create(activeHost);
                ServiceInfo serviceInfo = ServiceInfo.create("_http._tcp.local.", "localchat", serverPort, "LocalChat Tactical Communications");
                jmdns.registerService(serviceInfo);
                log.info("mDNS broadcast started on _http._tcp.local. (localchat.local:{})", serverPort);
            } catch (IOException e) {
                log.error("Failed to initialize JmDNS multicast", e);
            }
        } else {
            log.warn("Could not determine an active IPv4 LAN address for mDNS or QR generation.");
        }
    }

    private InetAddress getActiveLanIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                
                if (networkInterface.isLoopback() || networkInterface.isVirtual() || !networkInterface.isUp()) {
                    continue;
                }
                
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    // We specifically want an IPv4 site-local address
                    if (address instanceof Inet4Address && address.isSiteLocalAddress()) {
                        return address;
                    }
                }
            }
        } catch (SocketException e) {
            log.error("Failed to enumerate network interfaces", e);
        }
        return null;
    }

    private void printAsciiQrCode(String data) throws WriterException {
        Map<EncodeHintType, ErrorCorrectionLevel> hints = new HashMap<>();
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.L);
        QRCodeWriter qrCodeWriter = new QRCodeWriter();
        BitMatrix bitMatrix = qrCodeWriter.encode(data, BarcodeFormat.QR_CODE, 0, 0, hints);
        
        StringBuilder asciiQr = new StringBuilder("\n\n");
        // Iterate through matrix. We step by 2 in Y to render two rows per character (using half blocks)
        for (int y = 0; y < bitMatrix.getHeight(); y += 2) {
            for (int x = 0; x < bitMatrix.getWidth(); x++) {
                boolean top = bitMatrix.get(x, y);
                boolean bottom = (y + 1 < bitMatrix.getHeight()) && bitMatrix.get(x, y + 1);
                
                if (top && bottom) {
                    asciiQr.append("█");
                } else if (top) {
                    asciiQr.append("▀");
                } else if (bottom) {
                    asciiQr.append("▄");
                } else {
                    asciiQr.append(" ");
                }
            }
            asciiQr.append("\n");
        }
        asciiQr.append("\nScan QR to connect directly from an air-gapped or mobile device.\n");
        log.info(asciiQr.toString());
    }

    @PreDestroy
    public void cleanup() {
        if (jmdns != null) {
            log.info("Unregistering mDNS services and closing JmDNS...");
            jmdns.unregisterAllServices();
            try {
                jmdns.close();
            } catch (IOException e) {
                log.error("Error closing JmDNS", e);
            }
        }
    }
}
