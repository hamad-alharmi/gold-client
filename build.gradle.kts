import java.util.Base64

plugins {
    kotlin("jvm") version "1.9.22"
    id("com.github.johnrengelman.shadow") version "8.1.1"
    application
}

group = "dev.goldclient"
val buildNumber: String = System.getenv("BUILD_NUMBER") ?: "0"
val commitSha: String = System.getenv("COMMIT_SHA")?.take(8) ?: "local"
version = "1.0.$buildNumber-$commitSha"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
}

application {
    mainClass.set("dev.goldclient.MainKt")
    applicationDefaultJvmArgs = listOf(
        "-Xms256m",
        "-Xmx512m",
        "--add-opens=java.base/java.lang=ALL-UNNAMED",
        "--add-opens=java.base/java.io=ALL-UNNAMED",
        "-Djava.library.path=./native"
    )
}

tasks.shadowJar {
    archiveClassifier.set("")
    mergeServiceFiles()
    manifest {
        attributes(
            "Main-Class" to "dev.goldclient.MainKt",
            "Build-Number" to buildNumber,
            "Commit-SHA" to commitSha,
            "Implementation-Version" to version
        )
    }
}

// Optional: sign the JAR when SIGNING_KEYSTORE_BASE64 is present in CI
tasks.register("signJar") {
    dependsOn(tasks.shadowJar)
    doLast {
        val keystoreB64 = System.getenv("SIGNING_KEYSTORE_BASE64") ?: return@doLast
        val keystoreFile = File(buildDir, "signing.jks")
        keystoreFile.writeBytes(Base64.getDecoder().decode(keystoreB64))
        exec {
            commandLine(
                "jarsigner",
                "-keystore", keystoreFile.absolutePath,
                "-storepass", System.getenv("SIGNING_KEY_PASSWORD"),
                "-keypass", System.getenv("SIGNING_KEY_PASSWORD"),
                tasks.shadowJar.get().archiveFile.get().asFile.absolutePath,
                System.getenv("SIGNING_KEY_ALIAS")
            )
        }
        keystoreFile.delete()
    }
}
