package com.gradle;

interface Configuration {

    String getWorkflowName();

    String getJobName();

    String getPrNumber();

    String getBuildId();

    boolean isCaptureUnpublishedBuildScans(boolean isBuildFailure);

    boolean isCaptureBuildScanLinks(boolean isBuildFailure);

    String getBuildScanDataDir();

    String getBuildScanDataCopyDir();

    String getBuildScanLinkFile();

    String getBuildScanMetadataFilename();

}
