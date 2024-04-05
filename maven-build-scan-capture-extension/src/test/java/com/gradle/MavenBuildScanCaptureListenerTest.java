package com.gradle;

import com.gradle.develocity.agent.maven.api.scan.PublishedBuildScan;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.net.URI;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.function.BiPredicate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MavenBuildScanCaptureListenerTest {

    private final MavenBuildScanCaptureListener underTest = new MavenBuildScanCaptureListener();

    @Mock
    private Configuration configurationMock;
    @Mock
    private FileManager fileManagerMock;
    @Mock
    private PublishedBuildScan publishedBuildScanMock;

    @Test
    void captureBuildScanMetadata_withRepublication_success() throws Exception {
        // given
        when(configurationMock.isBuildScanRepublication()).thenReturn(true);
        when(configurationMock.getBuildScanMetadataDir()).thenReturn("metadataDir");
        underTest.setConfiguration(configurationMock);
        underTest.setFileManager(fileManagerMock);

        // when
        underTest.captureBuildScanMetadata();

        // then
        verify(fileManagerMock, times(1)).writeContent(any(File.class),anyString());
        verify(fileManagerMock, never()).copyDirectory(any(File.class),any(File.class));
        verify(fileManagerMock, never()).deleteDirectory(any(File.class));
    }

    @Test
    void captureBuildScanMetadata_withoutRepublication_success() throws Exception {
        // given
        when(configurationMock.isBuildScanRepublication()).thenReturn(false);
        when(configurationMock.isCaptureUnpublishedBuildScans(anyBoolean())).thenReturn(true);
        when(configurationMock.getBuildScanDataCopyDir()).thenReturn("dataCopyDir");
        when(configurationMock.getBuildScanMetadataCopyDir()).thenReturn("metadataCopyDir");
        when(configurationMock.getBuildScanDataDir()).thenReturn("dataDir");
        Path[] paths = {Path.of("foo", "bar"), Path.of("bar", "baz")};
        when(fileManagerMock.find(any(File.class),anyInt(),any(BiPredicate.class))).thenReturn(Arrays.stream(paths));
        underTest.setConfiguration(configurationMock);
        underTest.setFileManager(fileManagerMock);

        // when
        underTest.captureBuildScanMetadata();

        // then
        verify(fileManagerMock, times(1)).writeContent(any(File.class),anyString());
        verify(fileManagerMock, times(1)).copyDirectory(any(File.class),any(File.class));
        verify(fileManagerMock, times(1)).deleteDirectory(any(File.class));
    }

    @Test
    void captureBuildScanMetadata_withoutRepublicationWithCaptureDisabled_saveMetadata() throws Exception {
        // given
        when(configurationMock.isBuildScanRepublication()).thenReturn(false);
        when(configurationMock.isCaptureUnpublishedBuildScans(anyBoolean())).thenReturn(false);
        when(configurationMock.getBuildScanMetadataCopyDir()).thenReturn("metadataCopyDir");
        underTest.setFileManager(fileManagerMock);
        underTest.setConfiguration(configurationMock);

        // when
        underTest.captureBuildScanMetadata();

        // then
        verify(fileManagerMock, times(1)).writeContent(any(File.class),anyString());
        verify(fileManagerMock, never()).copyDirectory(any(File.class),any(File.class));
        verify(fileManagerMock, never()).deleteDirectory(any(File.class));
    }

    @Test
    void captureBuildScanMetadata_withoutRepublicationWithoutScanDump_saveMetadata() throws Exception {
        // given
        when(configurationMock.isCaptureUnpublishedBuildScans(anyBoolean())).thenReturn(true);
        when(configurationMock.getBuildScanDataDir()).thenReturn("dataDir");
        when(configurationMock.getBuildScanMetadataCopyDir()).thenReturn("metadataCopyDir");
        when(fileManagerMock.find(any(File.class),anyInt(),any(BiPredicate.class))).thenReturn(Arrays.stream(new Path[]{}));
        underTest.setFileManager(fileManagerMock);
        underTest.setConfiguration(configurationMock);

        // when
        underTest.captureBuildScanMetadata();

        // then
        verify(fileManagerMock, times(1)).writeContent(any(File.class),anyString());
        verify(fileManagerMock, never()).copyDirectory(any(File.class),any(File.class));
        verify(fileManagerMock, never()).deleteDirectory(any(File.class));
    }

    @Test
    void captureBuildScanLink_success() throws Exception {
        // given
        when(configurationMock.isCaptureBuildScanLinks(anyBoolean())).thenReturn(true);
        when(publishedBuildScanMock.getBuildScanUri()).thenReturn(new URI("http://localhost"));
        underTest.setConfiguration(configurationMock);
        underTest.setFileManager(fileManagerMock);

        // when
        underTest.captureBuildScanLink(publishedBuildScanMock);

        // then
        verify(publishedBuildScanMock, times(1)).getBuildScanUri();
    }

    @Test
    void captureBuildScanLink_WithCaptureDisabled_doesNothing() throws Exception {
        // given
        when(configurationMock.isCaptureBuildScanLinks(anyBoolean())).thenReturn(false);
        underTest.setConfiguration(configurationMock);
        underTest.setFileManager(fileManagerMock);

        // when
        underTest.captureBuildScanLink(publishedBuildScanMock);

        // then
        verify(publishedBuildScanMock, never()).getBuildScanUri();
    }

}
