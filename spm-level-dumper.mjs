import * as util from 'node:util';
import { access, readdir as _nfs_rd } from 'node:fs';
// import { execFile as _ncp_ef } from 'node:child_process';
import { exec as _ncp_e } from 'node:child_process';
// const execFile = util.promisify(_ncp_ef);
const exec = util.promisify(_ncp_e);
const readdir = util.promisify(_nfs_rd);


// [ CONFIGURE HERE, ONLY IF YOU NEED TO ] ----------
const PYTHON_BIN_NAME = "python3"; // May need to change this to just "python" depending on your system's python configuration
const DELETE_TMP_FILES = true; // Preserve the modified dumped game directory (don't clean up), useful if you want to go in and extract PNG textures or other data
const VERBOSE = true; // Leaving this enabled logs a console message for each file as it is generated, disabling it only console logs when each step begins (extraction, decompression, and conversion)
const VERBOSE_DEBUG = false; // Enabling this just shows the output from wit and number of found level files, not really much of a need for this
// --------------------------------------------------


console.log("Starting level dump of Super Paper Mario.\n");

// Create working folder structure (./output/tmp/extractedWbfs gets generated by wit)
await exec(`rm -rf ./output/`); // Delete 'output' folder in case there are leftovers from a previous attempt. Potentially destructive depending on how the script is run, take caution
await exec(`mkdir -p ./output/tmp/decompressedLevels`);
await exec(`mkdir -p ./output/tmp/extractedLevels`);

// Extract the wbfs archive using wit
console.log("Extracting .wbfs archive...");
const { stdout:witOutput } = await exec(`./utils/bin-utils/wit x "spm.wbfs" ./output/tmp/extractedWbfs`);
if (VERBOSE_DEBUG) console.log(witOutput);

// Iterate over raw level files, decompressing, extracting, and converting each of them
const levels = await readdir(`./output/tmp/extractedWbfs/files/map`);
if (VERBOSE_DEBUG) console.log(`Found ${levels.length} level${(levels.length>1)?"s":""}.`);

// Decompress each level
console.log("Decompressing levels...");
for (const level of levels) {
  if (VERBOSE) console.log(`Decompressing '${level}'...`);
  await exec(`${PYTHON_BIN_NAME} ./utils/python-utils/lzss3.py ./output/tmp/extractedWbfs/files/map/${level} > ./output/tmp/decompressedLevels/${level.substring(0, level.indexOf("."))}.decompressed`);
}

// Extract each level
console.log("Extracting levels...");
for (const level of levels) {
  const decompressedLevelName = `${level.substring(0, level.indexOf("."))}.decompressed`;
  if (VERBOSE) console.log(`Extracting '${decompressedLevelName}'...`);
  await exec(`./utils/bin-utils/wszst xall ./output/tmp/decompressedLevels/${decompressedLevelName} --dest ./output/tmp/extractedLevels/${level.substring(0, level.indexOf("."))}.extracted`);
}

// Convert each level to .obj
console.log("Converting levels...");
for (const level of levels) {
  const extractedLevelName = `${level.substring(0, level.indexOf("."))}.extracted`;
  if (VERBOSE) console.log(`Converting '${extractedLevelName}'...`);
  // Weird workaround used here to avoid modifying ttydview.py...
  // For each extracted level directory, we copy the python file
  // in and then run it, (deleting it afterwards), because ttydview.py
  // is very picky about where directories are in relation to itself.
  
  // Copy ttydview.py into the directory
  await exec(`cp ./utils/python-utils/ttydview.py ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/`);
  // Create directory structure required by ttydview.py ('map_data' and 'obj_files')
  await exec(`mkdir -p ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/map_data/`);
  await exec(`mkdir -p ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/obj_files/`);
  
  // Move the map.dat file into ttydview.py's map_data directory
  await exec(`mv ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/map.dat ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/map_data/`);
  // Run ttydview.py on each of the map data files
  await exec(`${PYTHON_BIN_NAME} ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/ttydview.py map.dat ${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}`);
  // Move the extracted .obj file to the output directory
  await exec(`mv ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/obj_files/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}.obj ./output/`);

  // There are many other things that we could "clean as we go" too. One is this stupidity:
  // Delete ttydview.py (otherwise we will fill up the disk with unnecessary duplicates)
  // I'm ignoring this for now though, because those copies apparently only take up < 100MB
  // await exec(`rm ./output/tmp/extractedLevels/${extractedLevelName}/dvd/map/${extractedLevelName.substring(0, extractedLevelName.indexOf("."))}/`);
}

// Remove all temporary files (if instructed to)
// You might actually want to disable DELETE_TMP_FILES, since this lets you examine more of the extracted game, including viewing PNG textures!
if (DELETE_TMP_FILES) await exec(`rm -rf ./output/tmp/`);

console.log(`\nLevel dump completed. ${levels.length} file${(levels.length>1)?"s":""} ${(levels.length>1)?"have":"has"} been written to './output'.`);