const vm = require('node:vm');
const {gunzipSync,} = require('node:zlib');
const {ok} = require('node:assert');

const MAGIC_NUMBER = Buffer.from([0xde, 0xc0]);
const ZERO_LENGTH_EXTERNAL_REFERENCE_TABLE = Buffer.alloc(2);
const DUMMY_BYTECODE = Buffer.from([
    83, 33, 70, 80, 48,
    1,  0,  0,  0,  0,
    0,  0
])

function generateScript(cachedData, filename) {
    if (!isBufferV8Bytecode(cachedData)) {
        // Try to decompress as Brotli
        cachedData = gunzipSync(cachedData);

        ok(isBufferV8Bytecode(cachedData), 'Invalid bytecode buffer');
    }

    fixBytecode(cachedData);

    const length = readSourceHash(cachedData);

    let dummyCode = '';

    // if (length > 1) {
    //     dummyCode = '"' + '\u200b'.repeat(length - 2) + '"'; // "\u200b" Zero width space
    // }

    const script = new vm.Script(Buffer.allocUnsafe(length), {cachedData, filename});

    if (script.cachedDataRejected) {
        throw new Error('Invalid or incompatible cached data (cachedDataRejected)');
    }

    return script;
}

function isBufferV8Bytecode(buffer) {
    return (
        Buffer.isBuffer(buffer) &&
        !buffer.subarray(0, 2).equals(ZERO_LENGTH_EXTERNAL_REFERENCE_TABLE) &&
        buffer.subarray(2, 4).equals(MAGIC_NUMBER)
    );

    // TODO: check that code start + payload size = buffer length. See
    //       https://github.com/bytenode/bytenode/issues/210#issuecomment-1605691369
}

// TODO: rewrite this function
const readSourceHash = function (bytecodeBuffer) {
    if (!Buffer.isBuffer(bytecodeBuffer)) {
        throw new Error('bytecodeBuffer must be a buffer object.');
    }

    if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9')) {
        // Node is v8.8.x or v8.9.x
        // eslint-disable-next-line no-return-assign
        return bytecodeBuffer.subarray(12, 16).reduce((sum, number, power) => sum += number * Math.pow(256, power), 0);
    } else {
        // eslint-disable-next-line no-return-assign
        return bytecodeBuffer.subarray(8, 12).reduce((sum, number, power) => sum += number * Math.pow(256, power), 0);
    }
};

const fixBytecode = function (bytecodeBuffer) {
    if (!Buffer.isBuffer(bytecodeBuffer)) {
        throw new Error('bytecodeBuffer must be a buffer object.');
    }

    const dummyBytecode = DUMMY_BYTECODE;
    const version = parseFloat(process.version.slice(1, 5));

    if (process.version.startsWith('v8.8') || process.version.startsWith('v8.9')) {
        // Node is v8.8.x or v8.9.x
        // dummyBytecode.subarray(16, 20).copy(bytecodeBuffer, 16);
        // dummyBytecode.subarray(20, 24).copy(bytecodeBuffer, 20);
        dummyBytecode.subarray(4, 8).copy(bytecodeBuffer, 16);
        dummyBytecode.subarray(8, 12).copy(bytecodeBuffer, 20);
    } else if (version >= 12 && version <= 21) {
        // dummyBytecode.subarray(12, 16).copy(bytecodeBuffer, 12);
        dummyBytecode.subarray(0, 4).copy(bytecodeBuffer, 12);
    } else {
        // dummyBytecode.subarray(12, 16).copy(bytecodeBuffer, 12);
        // dummyBytecode.subarray(16, 20).copy(bytecodeBuffer, 16);
        dummyBytecode.subarray(0, 4).copy(bytecodeBuffer, 12);
        dummyBytecode.subarray(4, 8).copy(bytecodeBuffer, 16);
    }
};


module.exports = {
    generateScript,
    readSourceHash,
    fixBytecode
}
