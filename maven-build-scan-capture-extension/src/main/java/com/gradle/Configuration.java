package com.gradle;

interface Configuration {

    String getWorkflowName();

    String getJobName();

    String getPrNumber();

    String getBuildId();

    boolean isCaptureUnpublishedBuildScans(boolean isBuildFailure);

    boolean isCaptureBuildScanLinks(boolean isBuildFailure);

    boolean isBuildScanRepublication();

    String getBuildScanDataDir();

    String getBuildScanMetadataDir();

    String getBuildScanDataCopyDir();

    String getBuildScanMetadataCopyDir();

}
