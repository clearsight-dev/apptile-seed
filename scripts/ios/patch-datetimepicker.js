const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '../../',
  'node_modules',
  '@react-native-community',
  'datetimepicker',
  'ios',
  'RNDateTimePicker.m',
);

try {
  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    console.log('RNDateTimePicker.m file not found, skipping patch');
    process.exit(0);
  }

  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check if lines 26 and 32 need to be commented
  let needsPatch = false;

  // Line 26 (0-indexed is 25)
  if (lines[25] && !lines[25].trim().startsWith('//')) {
    lines[25] = '    // ' + lines[25];
    needsPatch = true;
  }

  // Line 32 (0-indexed is 31)
  if (lines[31] && !lines[31].trim().startsWith('//')) {
    lines[31] = '    // ' + lines[31];
    needsPatch = true;
  }

  if (needsPatch) {
    // Write the modified content back
    const modifiedContent = lines.join('\n');
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
    console.log(
      '✅ Successfully patched RNDateTimePicker.m (commented lines 26 and 32)',
    );
  } else {
    console.log(
      'ℹ️  RNDateTimePicker.m already patched or lines already commented',
    );
  }
} catch (error) {
  console.error('❌ Error patching RNDateTimePicker.m:', error.message);
  process.exit(1);
}