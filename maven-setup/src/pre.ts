import * as core from "@actions/core";

/**
 * The pre-execution entry point for the action
 */
export async function run(): Promise<void> {
    core.warning(`The gradle/develocity-actions/maven-setup action is deprecated, use gradle/develocity-actions/setup-maven instead`)
}

run()
