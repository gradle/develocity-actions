package com.gradle;

import com.gradle.maven.extension.api.GradleEnterpriseApi;
import com.gradle.maven.extension.api.GradleEnterpriseListener;
import com.gradle.maven.extension.api.scan.PublishedBuildScan;
import org.apache.commons.io.FileUtils;
import org.apache.maven.execution.MavenSession;
import org.codehaus.plexus.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.stream.Stream;

@SuppressWarnings("unused")
@Component(
        role = GradleEnterpriseListener.class,
        hint = "maven-build-scan-capture-extension",
        description = "Maven Build Scan capture extension"
)
public final class MavenBuildScanCaptureListener implements GradleEnterpriseListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(MavenBuildScanCaptureListener.class);
    private static final String USER_HOME_SYSTEM_PROPERTY = "user.home";
    private static final String BUILD_SCAN_DATA_ORIGINAL_DIR = ".m2/.gradle-enterprise/build-scan-data/";
    private static final String BUILD_SCAN_DATA_COPY_DIR = "./build-scan-data";
    private static final String SCAN_DUMP_FILE_NAME = "scan.scan";
    private static final String BUILD_SCAN_LINKS_FILENAME = "build-scan-links.txt";

    private static final Configuration configuration = Configuration.get();

    @Override
    public void configure(GradleEnterpriseApi gradleEnterpriseApi, MavenSession session) {
        LOGGER.info("Configuring extension: " + getClass().getSimpleName());

        // Capture Build result
        gradleEnterpriseApi.getBuildScan().buildFinished(buildResult -> {
            if(!buildResult.getFailures().isEmpty()) {
                LOGGER.debug("Marking build failure");
                configuration.setBuildFailure();
            }
        });

        // The buildFinished callback is called too early to collect the previous build scan
        //gradleEnterpriseApi.getBuildScan().buildFinished(buildResult -> captureUnpublishedBuildScanDump("build finished hook"));
        Runtime.getRuntime().addShutdownHook(new Thread(this::captureUnpublishedBuildScan));

        gradleEnterpriseApi.getBuildScan().buildScanPublished(this::captureBuildScanLink);
    }

    private String getUserHome() {
        return System.getProperty(USER_HOME_SYSTEM_PROPERTY);
    }

    private String getBuildScanDataCopyDir() {
        return BUILD_SCAN_DATA_COPY_DIR;
    }

    private void captureUnpublishedBuildScan() {
      LOGGER.debug(configuration.toString());
      if(configuration.isBuildScanCaptureUnpublishedEnabled()) {
          LOGGER.info("Configuring unpublished Build Scan capture");

          File buildScanDirectory = new File(getUserHome(), BUILD_SCAN_DATA_ORIGINAL_DIR);

          try (Stream<Path> pathStream = Files.find(Paths.get(getUserHome(), BUILD_SCAN_DATA_ORIGINAL_DIR),
                  Integer.MAX_VALUE,
                  (filePath, fileAttr) -> filePath.getFileName().toString().equals(SCAN_DUMP_FILE_NAME) && fileAttr.isRegularFile())) {
              if (pathStream.findAny().isPresent()) {
                  LOGGER.debug("Saving unpublished build scan");
                  File destinationDirectory = new File(getBuildScanDataCopyDir());
                  FileUtils.copyDirectory(buildScanDirectory, destinationDirectory);
              } else {
                  LOGGER.debug("No unpublished build scan found");
              }
          } catch (IOException e) {
              LOGGER.warn("Could not capture unpublished build scan link", e);
          }
      } else {
          LOGGER.debug("Build scan capture disabled");
      }
    }

    private void captureBuildScanLink(PublishedBuildScan buildScan) {
        if(configuration.isBuildScanCaptureLinkEnabled()) {
            LOGGER.info("Configuring Build Scan link capture");

            try {
                LOGGER.debug("Adding build scan link: " + buildScan.getBuildScanUri());
                Files.write(Paths.get(BUILD_SCAN_LINKS_FILENAME), (buildScan.getBuildScanUri() + "\n").getBytes(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (IOException e) {
                LOGGER.warn("Could not add build scan link: " + buildScan.getBuildScanUri(), e);
            }
        } else {
            LOGGER.debug("Build scan link capture disabled");
        }
    }

}
