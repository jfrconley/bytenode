const {compileFile} = require("../../lib/index.js");
const path = require("path");
const fs = require("fs");
const {execSync} = require("child_process");

function bytesToHuman(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

function percentChange(a, b) {
    return ((b - a) / a) * 100;
}

function absolutePercentChange(a, b) {
    return 100 + percentChange(a, b);
}

const RAW_BUNDLE_PATH = path.join(__dirname, "raw-bundle.js");
const ARTIFACTS_PATH = path.join(__dirname, "artifacts");

const UNCOMPRESSED_OUTPUT_PATH = path.join(ARTIFACTS_PATH, "uncompressed");
const UNCOMPRESSED_BYTECODE_OUTPUT_PATH = path.join(UNCOMPRESSED_OUTPUT_PATH, "bytecode.jsc");
const UNCOMPRESSED_LOADER_OUTPUT_PATH = path.join(UNCOMPRESSED_OUTPUT_PATH, "loader.js");

const COMPRESSED_OUTPUT_PATH = path.join(ARTIFACTS_PATH, "compressed");
const COMPRESSED_BYTECODE_OUTPUT_PATH = path.join(COMPRESSED_OUTPUT_PATH, "bytecode.jsc");
const COMPRESSED_LOADER_OUTPUT_PATH = path.join(COMPRESSED_OUTPUT_PATH, "loader.js");

async function benchmark() {
    // check that hyperfine is installed
    try {
        execSync("hyperfine --version", {stdio: "ignore"});
    } catch (e) {
        console.error("hyperfine is not installed. Please install it using `cargo install hyperfine`");
        process.exit(1);
    }

    // Delete old artifacts
    if (fs.existsSync(ARTIFACTS_PATH)) {
        fs.rmSync(ARTIFACTS_PATH, {recursive: true});
    }
    fs.mkdirSync(UNCOMPRESSED_OUTPUT_PATH, {recursive: true});
    fs.mkdirSync(COMPRESSED_OUTPUT_PATH, {recursive: true});

    // Compile bytecodes
    const uncompressedTime = Date.now();
    await compileFile({
        filename: RAW_BUNDLE_PATH,
        output: UNCOMPRESSED_BYTECODE_OUTPUT_PATH,
        loaderFilename: "loader.js",
        compileAsModule: true,
        createLoader: true,
        compress: false,
    });
    const uncompressedDuration = Date.now() - uncompressedTime;

    const compressedTime = Date.now();
    await compileFile({
        filename: RAW_BUNDLE_PATH,
        output: COMPRESSED_BYTECODE_OUTPUT_PATH,
        loaderFilename: "loader.js",
        compress: true,
        compileAsModule: true,
        createLoader: true,
    });
    const compressedDuration = Date.now() - compressedTime;

    // Bundle size benchmark
    const baselineBytes = fs.statSync(RAW_BUNDLE_PATH).size;
    const uncompressedBytes = fs.statSync(UNCOMPRESSED_BYTECODE_OUTPUT_PATH).size;
    const compressedBytes = fs.statSync(COMPRESSED_BYTECODE_OUTPUT_PATH).size;

    const baseline = bytesToHuman(baselineBytes);
    const uncompressed = bytesToHuman(uncompressedBytes);
    const compressed = bytesToHuman(compressedBytes);

    console.log(`Baseline: (Size: ${baseline}  100%) (Time: 0ms)`);
    console.log(`Uncompressed: (Size: ${uncompressed}  ${absolutePercentChange(baselineBytes, uncompressedBytes).toFixed(2)}%) (Time: ${uncompressedDuration}ms)`);
    console.log(`Compressed: (Size: ${compressed}  ${absolutePercentChange(baselineBytes, compressedBytes).toFixed(2)}%) (Time: ${compressedDuration}ms)`);

    // Run hyperfine
    execSync(
        `hyperfine --warmup 3 'node ${RAW_BUNDLE_PATH}' 'node ${UNCOMPRESSED_LOADER_OUTPUT_PATH}' 'node ${COMPRESSED_LOADER_OUTPUT_PATH}'`,
        {
            stdio: "inherit",
        }
    )
}


benchmark()
