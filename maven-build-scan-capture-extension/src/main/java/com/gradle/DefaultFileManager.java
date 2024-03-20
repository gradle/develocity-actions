package com.gradle;

import org.apache.commons.io.FileUtils;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.function.BiPredicate;
import java.util.stream.Stream;

class DefaultFileManager implements FileManager {

    @Override
    public void writeContent(File file, String content) throws IOException {
        Files.createDirectories(file.toPath().getParent());
        Files.write(file.toPath(), content.getBytes(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    @Override
    public void copyDirectory(File source, File target) throws IOException {
        FileUtils.copyDirectory(source, target);
    }

    @Override
    public void copyFile(File source, File target) throws IOException {
        FileUtils.copyFile(source, target);
    }

    @Override
    public void deleteDirectory(File buildScanDirectory) throws IOException {
        FileUtils.deleteDirectory(buildScanDirectory);
    }

    @Override
    public Stream<Path> find(File start,
                             int maxDepth,
                             BiPredicate<Path, BasicFileAttributes> matcher) throws IOException {
        return Files.find(start.toPath(), maxDepth, matcher);
    }
}
