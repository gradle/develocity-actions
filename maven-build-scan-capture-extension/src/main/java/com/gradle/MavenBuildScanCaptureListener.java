package com.gradle;

import com.gradle.develocity.agent.maven.api.DevelocityApi;
import com.gradle.develocity.agent.maven.api.DevelocityListener;
import com.gradle.develocity.agent.maven.api.scan.PublishedBuildScan;
import org.apache.maven.execution.MavenSession;
import org.apache.maven.rtinfo.internal.DefaultRuntimeInformation;
import org.codehaus.plexus.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

@SuppressWarnings("unused")
@Component(
        role = DevelocityListener.class,
        hint = "maven-build-scan-capture-extension",
        description = "Maven Build Scan capture extension"
)
public final class MavenBuildScanCaptureListener implements DevelocityListener {

    private static final Logger LOGGER = LoggerFactory.getLogger(MavenBuildScanCaptureListener.class);
    private static final String SCAN_DUMP_REGEX = ".*/build-scan-data/.*/previous/.*/scan.scan";
    private BuildState buildState = new BuildState();
    private Configuration configuration = DefaultConfiguration.get();
    private FileManager fileManager = new DefaultFileManager();

    public void setBuildState(BuildState buildState) {
        this.buildState = buildState;
    }

    public void setConfiguration(Configuration configuration) {
        this.configuration = configuration;
    }

    public void setFileManager(FileManager fileManager) {
        this.fileManager = fileManager;
    }

    @Override
    public void configure(DevelocityApi develocityApi, MavenSession session) {
        LOGGER.info("Configuring extension: " + getClass().getSimpleName());
        LOGGER.debug(configuration.toString());

        // Set Maven data
        buildState.setBuildId(UUID.randomUUID().toString());
        buildState.setBuildTimestamp(String.valueOf(System.currentTimeMillis()));
        buildState.setMavenVersion(getMavenVersion());
        buildState.setArtifactId(session.getCurrentProject().getArtifactId());
        buildState.setMavenGoals(String.join(" ", session.getRequest().getGoals()));

        // Capture build result
        develocityApi.getBuildScan().buildFinished(buildResult -> {
            if(!buildResult.getFailures().isEmpty()) {
                LOGGER.debug("Marking build failure");
                buildState.setBuildFailure();
            }
        });

        // Capture build scan link
        develocityApi.getBuildScan().buildScanPublished(this::captureBuildScanLink);

        // Capture build scan metadata with a shutdown hook
        // The develocityApi.getBuildScan().buildFinished callback is called too early to collect the previous build scan
        Runtime.getRuntime().addShutdownHook(new Thread(this::captureBuildScanMetadata));
    }

    private String getMavenVersion() {
        try {
            // trying to fetch Maven version from internal class
            Class<?> rtInfoClass = Class.forName("org.apache.maven.rtinfo.internal.DefaultRuntimeInformation", true, MavenBuildScanCaptureListener.class.getClassLoader());
            DefaultRuntimeInformation rtInfo = (DefaultRuntimeInformation) rtInfoClass.getDeclaredConstructor().newInstance();
            return rtInfo.getMavenVersion();
        } catch (ClassNotFoundException | NoSuchMethodException | InstantiationException | IllegalAccessException |
                 InvocationTargetException e) {
            LOGGER.info("Unable to fetch Maven version " + e.getMessage());
        }

        return "unknown";
    }

    void captureBuildScanLink(PublishedBuildScan publishedBuildScan) {
        if(configuration.isCaptureBuildScanLinks(buildState.isBuildFailure())) {
            LOGGER.info("Capturing build scan link");
            String buildScanLink = publishedBuildScan.getBuildScanUri().toString();
            buildState.setBuildScanLink(buildScanLink);
            addToGitHubOutput("build-scan-url", buildScanLink);
        } else {
            LOGGER.debug("Build scan link capture disabled");
        }
    }

    private void addToGitHubOutput(String key, String value) {
        try {
            String githubOutput = System.getenv("GITHUB_OUTPUT");
            if (githubOutput != null) {
                String content = key + "=" + value + "\n";
                Files.write(Paths.get(githubOutput), content.getBytes(StandardCharsets.UTF_8), StandardOpenOption.APPEND);
            }
        } catch (IOException e) {
            LOGGER.info("Unable to add " + key + " to GitHub output " + e.getMessage());
        }
    }

    void captureBuildScanMetadata() {
        if(configuration.isBuildScanRepublication()) {
            appendBuildScanLinkToMetadataFile();
        } else {
            saveBuildScanMetadata();
            captureUnpublishedBuildScan();
        }
    }

    private void captureUnpublishedBuildScan() {
      if(configuration.isCaptureUnpublishedBuildScans(buildState.isBuildFailure())) {
          File buildScanDataDir = new File(configuration.getBuildScanDataDir());

          try (Stream<Path> pathStream = fileManager.find(buildScanDataDir,
                  Integer.MAX_VALUE,
                  (filePath, fileAttr) -> filePath.toString().replace("\\","/").matches(SCAN_DUMP_REGEX) && fileAttr.isRegularFile())) {
              Optional<Path> scanDumpPath = pathStream.findFirst();
              if (scanDumpPath.isPresent()) {
                  File currentMetadataFile = getMetadataFile(buildState.getBuildId());
                  String buildId = scanDumpPath.get().getParent().getFileName().toString();

                  LOGGER.info("Found unpublished build scan " + buildId);
                  buildState.setBuildId(buildId);

                  LOGGER.debug("Saving unpublished build scan data");
                  File buildScanDataCopyDir = new File(configuration.getBuildScanDataCopyDir());
                  fileManager.copyDirectory(buildScanDataDir, buildScanDataCopyDir);

                  LOGGER.debug("Saving unpublished build scan metadata");
                  File buildScanMetadataCopyDir = new File(configuration.getBuildScanMetadataCopyDir());
                  fileManager.copyFile(currentMetadataFile, getMetadataCopyFile(buildId));

                  LOGGER.debug("Delete build scan data");
                  fileManager.deleteDirectory(buildScanDataDir);
              } else {
                  LOGGER.debug("No unpublished build scan found");
              }
          } catch (IOException e) {
              LOGGER.warn("Could not capture unpublished build scan link", e);
          }
      } else {
          LOGGER.debug("Unpublished build scan capture disabled");
      }
    }

    private String collectBuildScanMetadata() {
        return String.format("PR_NUMBER=%s\nPROJECT_ID=%s\nWORKFLOW_NAME=%s\nJOB_NAME=%s\nBUILD_TOOL_VERSION=%s\nREQUESTED_TASKS=%s\nBUILD_FAILURE=%s\nTIMESTAMP=%s\n%s",
                configuration.getPrNumber(),
                buildState.getArtifactId(),
                configuration.getWorkflowName(),
                configuration.getJobName(),
                buildState.getMavenVersion(),
                buildState.getMavenGoals(),
                buildState.isBuildFailure(),
                buildState.getBuildTimestamp(),
                getBuildScanLinkEntry()
        );
    }

    private void saveBuildScanMetadata() {
        try {
            LOGGER.debug("Saving build scan metadata for " + buildState.getBuildId());
            fileManager.writeContent(getMetadataFile(buildState.getBuildId()), collectBuildScanMetadata());
        } catch (IOException e) {
            LOGGER.warn("Could not create build metadata file", e);
        }
    }

    private void appendBuildScanLinkToMetadataFile() {
        String buildScanLinkEntry = getBuildScanLinkEntry();
        if(!buildScanLinkEntry.isEmpty()) {
            try {
                LOGGER.debug("Adding build scan link for " + configuration.getBuildId());
                fileManager.writeContent(getMetadataFile(configuration.getBuildId()), buildScanLinkEntry);
            } catch (IOException e) {
                LOGGER.warn("Could not update metadata file", e);
            }
        }
    }

    private String getBuildScanLinkEntry() {
        String buildScanLinkEntry = "";
        if(buildState.getBuildScanLink() != null && !buildState.getBuildScanLink().isEmpty()) {
            buildScanLinkEntry = String.format("BUILD_SCAN_LINK=%s\n", buildState.getBuildScanLink());
        }
        return buildScanLinkEntry;
    }

    private File getMetadataFile(String buildId) {
        return Paths.get(configuration.getBuildScanMetadataDir(), buildId + ".txt").toFile();
    }

    private File getMetadataCopyFile(String buildId) {
        return Paths.get(configuration.getBuildScanMetadataCopyDir(), buildId + ".txt").toFile();
    }
}
