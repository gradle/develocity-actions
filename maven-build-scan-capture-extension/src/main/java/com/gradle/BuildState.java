package com.gradle;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

class BuildState {

    private final AtomicReference<String> buildId = new AtomicReference<>();
    private final AtomicReference<String> buildTimestamp = new AtomicReference<>();
    private final AtomicReference<String> mavenVersion = new AtomicReference<>();
    private final AtomicReference<String> artifactId = new AtomicReference<>();
    private final AtomicReference<String> mavenGoals = new AtomicReference<>();
    private final AtomicBoolean isBuildFailure = new AtomicBoolean(false);
    private final AtomicReference<String> buildScanLink = new AtomicReference<>();

    String getBuildId() {
        return buildId.get();
    }

    void setBuildId(String buildId) {
        this.buildId.set(buildId);
    }

    String getBuildTimestamp() {
        return buildTimestamp.get();
    }

    void setBuildTimestamp(String buildTimestamp) {
        this.buildTimestamp.set(buildTimestamp);
    }

    String getMavenVersion() {
        return mavenVersion.get();
    }

    void setMavenVersion(String mavenVersion) {
        this.mavenVersion.set(mavenVersion);
    }

    String getArtifactId() {
        return artifactId.get();
    }

    void setArtifactId(String artifactId) {
        this.artifactId.set(artifactId);
    }

    String getMavenGoals() {
        return mavenGoals.get();
    }

    void setMavenGoals(String goals) {
        mavenGoals.set(goals);
    }

    boolean isBuildFailure() {
        return isBuildFailure.get();
    }

    void setBuildFailure() {
        isBuildFailure.set(true);
    }

    String getBuildScanLink() {
        return buildScanLink.get();
    }

    void setBuildScanLink(String newBuildScanLink) {
        buildScanLink.set(newBuildScanLink);
    }

    @Override
    public String toString() {
        return "BuildState{" +
                "buildId=" + buildId +
                ", buildTimestamp=" + buildTimestamp +
                ", mavenVersion=" + mavenVersion +
                ", artifactId=" + artifactId +
                ", mavenGoals=" + mavenGoals +
                ", isBuildFailure=" + isBuildFailure +
                ", buildScanLink=" + buildScanLink +
                '}';
    }
}
