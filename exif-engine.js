/**
 * Forensic Binary Metadata Parser & Real Mobile EXIF Builder Engine
 * Reads raw ArrayBuffer bytes directly without decoding or re-encoding pixels.
 * Builds authentic multi-IFD Mobile Camera EXIF binary headers (IFD0, ExifSubIFD, InteropIFD, GPSIFD, and IFD1 Embedded Thumbnail)
 * and losslessly splices them into JPEG streams without re-compressing image scan bytes.
 */

const EXIF_TAGS = {
  // IFD0 / IFD1 / TIFF Tags
  0x0100: 'ImageWidth',
  0x0101: 'ImageLength',
  0x0102: 'BitsPerSample',
  0x0103: 'Compression',
  0x0106: 'PhotometricInterpretation',
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x0115: 'SamplesPerPixel',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x011c: 'PlanarConfiguration',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x013e: 'WhitePoint',
  0x013f: 'PrimaryChromaticities',
  0x0201: 'JPEGInterchangeFormat',
  0x0202: 'JPEGInterchangeFormatLength',
  0x0211: 'YCbCrCoefficients',
  0x0212: 'YCbCrSubSampling',
  0x0213: 'YCbCrPositioning',
  0x0214: 'ReferenceBlackWhite',
  0x8298: 'Copyright',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0xc612: 'DNGVersion',
  0xc614: 'UniqueCameraModel',

  // Exif SubIFD Tags
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8822: 'ExposureProgram',
  0x8824: 'SpectralSensitivity',
  0x8827: 'ISOSpeedRatings',
  0x8828: 'OECF',
  0x8830: 'SensitivityType',
  0x8832: 'RecommendedExposureIndex',
  0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9010: 'OffsetTime',
  0x9011: 'OffsetTimeOriginal',
  0x9012: 'OffsetTimeDigitized',
  0x9101: 'ComponentsConfiguration',
  0x9102: 'CompressedBitsPerPixel',
  0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue',
  0x9203: 'BrightnessValue',
  0x9204: 'ExposureBiasValue',
  0x9205: 'MaxApertureValue',
  0x9206: 'SubjectDistance',
  0x9207: 'MeteringMode',
  0x9208: 'LightSource',
  0x9209: 'Flash',
  0x920a: 'FocalLength',
  0x9214: 'SubjectArea',
  0x927c: 'MakerNote',
  0x9286: 'UserComment',
  0x9290: 'SubSecTime',
  0x9291: 'SubSecTimeOriginal',
  0x9292: 'SubSecTimeDigitized',
  0xa000: 'FlashpixVersion',
  0xa001: 'ColorSpace',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa004: 'RelatedSoundFile',
  0xa005: 'InteroperabilityIFDPointer',
  0xa20b: 'FlashEnergy',
  0xa20e: 'FocalPlaneXResolution',
  0xa20f: 'FocalPlaneYResolution',
  0xa210: 'FocalPlaneResolutionUnit',
  0xa214: 'SubjectLocation',
  0xa215: 'ExposureIndex',
  0xa217: 'SensingMethod',
  0xa300: 'FileSource',
  0xa301: 'SceneType',
  0xa302: 'CFAPattern',
  0xa401: 'CustomRendered',
  0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance',
  0xa404: 'DigitalZoomRatio',
  0xa405: 'FocalLengthIn35mmFilm',
  0xa406: 'SceneCaptureType',
  0xa407: 'GainControl',
  0xa408: 'Contrast',
  0xa409: 'Saturation',
  0xa40a: 'Sharpness',
  0xa40b: 'DeviceSettingDescription',
  0xa40c: 'SubjectDistanceRange',
  0xa420: 'ImageUniqueID',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber',
  0xa460: 'CompositeImage',
  0xa500: 'Gamma'
};

const GPS_TAGS = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x0007: 'GPSTimeStamp',
  0x0008: 'GPSSatellites',
  0x0009: 'GPSStatus',
  0x000a: 'GPSMeasureMode',
  0x000b: 'GPSDOP',
  0x000c: 'GPSSpeedRef',
  0x000d: 'GPSSpeed',
  0x000e: 'GPSTrackRef',
  0x000f: 'GPSTrack',
  0x0010: 'GPSImgDirectionRef',
  0x0011: 'GPSImgDirection',
  0x0012: 'GPSMapDatum',
  0x0013: 'GPSDestLatitudeRef',
  0x0014: 'GPSDestLatitude',
  0x0015: 'GPSDestLongitudeRef',
  0x0016: 'GPSDestLongitude',
  0x0017: 'GPSDestBearingRef',
  0x0018: 'GPSDestBearing',
  0x0019: 'GPSDestDistanceRef',
  0x001a: 'GPSDestDistance',
  0x001b: 'GPSProcessingMethod',
  0x001c: 'GPSAreaInformation',
  0x001d: 'GPSDateStamp',
  0x001e: 'GPSDifferential',
  0x001f: 'GPSHPositioningError'
};

const INTEROP_TAGS = {
  0x0001: 'InteroperabilityIndex',
  0x0002: 'InteroperabilityVersion',
  0x1000: 'RelatedImageFileFormat',
  0x1001: 'RelatedImageWidth',
  0x1002: 'RelatedImageLength'
};

const JPEG_MARKERS = {
  0xd8: 'SOI (Start of Image)',
  0xd9: 'EOI (End of Image)',
  0xda: 'SOS (Start of Scan - Raw Compressed Entropy Data)',
  0xdb: 'DQT (Define Quantization Table)',
  0xdc: 'DNL (Define Number of Lines)',
  0xdd: 'DRI (Define Restart Interval)',
  0xc0: 'SOF0 (Baseline DCT)',
  0xc1: 'SOF1 (Extended Sequential DCT)',
  0xc2: 'SOF2 (Progressive DCT)',
  0xc3: 'SOF3 (Lossless Sequential)',
  0xc4: 'DHT (Define Huffman Table)',
  0xe0: 'APP0 (JFIF / JFXX)',
  0xe1: 'APP1 (EXIF / XMP)',
  0xe2: 'APP2 (ICC Color Profile / FlashPix)',
  0xe3: 'APP3 (Meta)',
  0xe4: 'APP4',
  0xe5: 'APP5',
  0xe6: 'APP6',
  0xe7: 'APP7',
  0xe8: 'APP8',
  0xe9: 'APP9',
  0xea: 'APP10',
  0xeb: 'APP11',
  0xec: 'APP12 (Picture Info / Ducky)',
  0xed: 'APP13 (IPTC / Photoshop IRB)',
  0xee: 'APP14 (Adobe DCT)',
  0xef: 'APP15',
  0xfe: 'COM (Comment)'
};

const TYPE_SIZES = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8  // DOUBLE
};

/**
 * Built-in Real Mobile Camera Hardware Profiles
 * Matches exact factory EXIF parameters from real smartphones.
 */
const MOBILE_PROFILES = {
  pixel_10_pro: {
    id: 'pixel_10_pro',
    displayName: 'Google Pixel 10 Pro (Android 16 - HDR+)',
    make: 'Google',
    model: 'Pixel 10 Pro',
    software: 'HDR+ 1.0.684521034zd',
    lensMake: 'Google',
    lensModel: 'Pixel 10 Pro back camera 6.9mm f/1.68',
    fNumber: [168, 100],        // f/1.68
    maxApertureApex: [150, 100],
    focalLength: [690, 100],    // 6.90 mm
    focalLength35mm: 24,
    lensSpec: [[690, 100], [690, 100], [168, 100], [168, 100]],
    defaultIso: 74,
    defaultExposure: [1, 125],
    filePrefix: 'PXL'
  },
  pixel_10: {
    id: 'pixel_10',
    displayName: 'Google Pixel 10 (Android 16 - HDR+)',
    make: 'Google',
    model: 'Pixel 10',
    software: 'HDR+ 1.0.684521034zd',
    lensMake: 'Google',
    lensModel: 'Pixel 10 back camera 6.81mm f/1.7',
    fNumber: [170, 100],        // f/1.7
    maxApertureApex: [153, 100],
    focalLength: [681, 100],    // 6.81 mm
    focalLength35mm: 24,
    lensSpec: [[681, 100], [681, 100], [170, 100], [170, 100]],
    defaultIso: 80,
    defaultExposure: [1, 120],
    filePrefix: 'PXL'
  },
  samsung_s24_ultra: {
    id: 'samsung_s24_ultra',
    displayName: 'Samsung Galaxy S24 Ultra (SM-S928B)',
    make: 'samsung',
    model: 'SM-S928B',
    software: 'S928BXXU3AXFE',
    lensMake: 'samsung',
    lensModel: 'Samsung Galaxy S24 Ultra Rear Wide 6.3mm f/1.7',
    fNumber: [170, 100],        // f/1.7
    maxApertureApex: [153, 100],
    focalLength: [630, 100],    // 6.30 mm
    focalLength35mm: 23,
    lensSpec: [[630, 100], [630, 100], [170, 100], [170, 100]],
    defaultIso: 64,
    defaultExposure: [1, 100],
    filePrefix: 'SAM'
  },
  iphone_16_pro: {
    id: 'iphone_16_pro',
    displayName: 'Apple iPhone 16 Pro (iOS 18.1)',
    make: 'Apple',
    model: 'iPhone 16 Pro',
    software: '18.1',
    lensMake: 'Apple',
    lensModel: 'iPhone 16 Pro back triple camera 6.765mm f/1.78',
    fNumber: [178, 100],        // f/1.78
    maxApertureApex: [166, 100],
    focalLength: [6765, 1000],  // 6.765 mm
    focalLength35mm: 24,
    lensSpec: [[2220, 1000], [15660, 1000], [178, 100], [280, 100]],
    defaultIso: 64,
    defaultExposure: [1, 122],
    filePrefix: 'IMG'
  },
  xiaomi_14_ultra: {
    id: 'xiaomi_14_ultra',
    displayName: 'Xiaomi 14 Ultra (Leica Summilux)',
    make: 'Xiaomi',
    model: '24030PN60G',
    software: 'OS1.0.8.0.UNAMIXM',
    lensMake: 'Leica',
    lensModel: 'LEICA VARIO-SUMMILUX 1:1.63-2.5/12-120 ASPH.',
    fNumber: [163, 100],        // f/1.63
    maxApertureApex: [141, 100],
    focalLength: [872, 100],    // 8.72 mm
    focalLength35mm: 23,
    lensSpec: [[872, 100], [872, 100], [163, 100], [400, 100]],
    defaultIso: 50,
    defaultExposure: [1, 160],
    filePrefix: 'IMG'
  }
};

function readAscii(view, offset, length) {
  let out = '';
  const end = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < end; i++) {
    const c = view.getUint8(i);
    if (c === 0) break;
    out += (c >= 32 && c <= 126) ? String.fromCharCode(c) : '.';
  }
  return out;
}

function bytesToHex(uint8, maxBytes = 64) {
  const len = Math.min(uint8.length, maxBytes);
  const parts = [];
  for (let i = 0; i < len; i++) {
    parts.push(uint8[i].toString(16).padStart(2, '0').toUpperCase());
  }
  if (uint8.length > maxBytes) {
    parts.push(`... (+${uint8.length - maxBytes} bytes)`);
  }
  return parts.join(' ');
}

function generateHexDump(buffer, maxBytes = 512) {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, maxBytes));
  const rows = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const slice = bytes.subarray(offset, offset + 16);
    const hexPart = Array.from(slice)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ')
      .padEnd(47, ' ');
    const asciiPart = Array.from(slice)
      .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    rows.push(`${offset.toString(16).padStart(6, '0').toUpperCase()}  ${hexPart}  |${asciiPart}|`);
  }
  return rows.join('\n');
}

async function computeHashes(buffer) {
  const result = { sha256: 'Unavailable (Non-Secure Context)', sha1: 'Unavailable' };
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const [sha256Buf, sha1Buf] = await Promise.all([
        window.crypto.subtle.digest('SHA-256', buffer),
        window.crypto.subtle.digest('SHA-1', buffer)
      ]);
      result.sha256 = Array.from(new Uint8Array(sha256Buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      result.sha1 = Array.from(new Uint8Array(sha1Buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (err) {
      result.error = err.message;
    }
  }
  return result;
}

/**
 * Parses a TIFF header and its IFDs (IFD0, ExifIFD, GPSIFD, InteropIFD, IFD1).
 */
function parseTiff(view, tiffStart, maxLength) {
  const result = {
    byteOrder: null,
    ifd0: {},
    exifIfd: {},
    gpsIfd: {},
    interopIfd: {},
    ifd1: {},
    rawTagCount: 0
  };

  if (tiffStart + 8 > view.byteLength) return result;

  const endianMarker = view.getUint16(tiffStart, false);
  let littleEndian = false;
  if (endianMarker === 0x4949) {
    littleEndian = true;
    result.byteOrder = 'Little Endian (II / Intel)';
  } else if (endianMarker === 0x4d4d) {
    littleEndian = false;
    result.byteOrder = 'Big Endian (MM / Motorola)';
  } else {
    result.byteOrder = `Unknown (0x${endianMarker.toString(16)})`;
    return result;
  }

  const magic = view.getUint16(tiffStart + 2, littleEndian);
  if (magic !== 0x002a && magic !== 0x4f52 && magic !== 0x0055) {
    return result;
  }

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);

  function readTagValue(type, count, valueOffset) {
    const byteSize = (TYPE_SIZES[type] || 1) * count;
    let dataOffset = valueOffset;
    if (byteSize > 4) {
      dataOffset = tiffStart + view.getUint32(valueOffset, littleEndian);
    }
    if (dataOffset < 0 || dataOffset + byteSize > view.byteLength) {
      return '<Out of bounds>';
    }

    if (type === 2) {
      return readAscii(view, dataOffset, count);
    }

    if (type === 7 || type === 1) {
      const arr = new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(count, 256));
      if (count === 4 && type === 7) {
        const ascii4 = readAscii(view, dataOffset, 4);
        if (/^[0-9]{4}$/.test(ascii4)) return ascii4;
        if (arr[0] === 1 && arr[1] === 2 && arr[2] === 3 && arr[3] === 0) return 'YCbCr (1, 2, 3, 0)';
      }
      if (count > 8) {
        const asciiCandidate = readAscii(view, dataOffset, Math.min(count, 128));
        if (asciiCandidate.startsWith('ASCII')) {
          return readAscii(view, dataOffset + 8, count - 8);
        }
      }
      if (count === 1) return arr[0];
      if (count <= 16) return Array.from(arr);
      return `Binary (${count} bytes): ${bytesToHex(arr, 24)}`;
    }

    const values = [];
    const safeCount = Math.min(count, 64);
    for (let i = 0; i < safeCount; i++) {
      const pos = dataOffset + i * TYPE_SIZES[type];
      if (pos + TYPE_SIZES[type] > view.byteLength) break;
      switch (type) {
        case 3:
          values.push(view.getUint16(pos, littleEndian));
          break;
        case 4:
          values.push(view.getUint32(pos, littleEndian));
          break;
        case 5: {
          const num = view.getUint32(pos, littleEndian);
          const den = view.getUint32(pos + 4, littleEndian);
          const dec = den !== 0 ? Number((num / den).toFixed(6)) : 0;
          values.push({ numerator: num, denominator: den, decimal: dec, formatted: `${num}/${den} (${dec})` });
          break;
        }
        case 6:
          values.push(view.getInt8(pos));
          break;
        case 8:
          values.push(view.getInt16(pos, littleEndian));
          break;
        case 9:
          values.push(view.getInt32(pos, littleEndian));
          break;
        case 10: {
          const num = view.getInt32(pos, littleEndian);
          const den = view.getInt32(pos + 4, littleEndian);
          const dec = den !== 0 ? Number((num / den).toFixed(6)) : 0;
          values.push({ numerator: num, denominator: den, decimal: dec, formatted: `${num}/${den} (${dec})` });
          break;
        }
        case 11:
          values.push(view.getFloat32(pos, littleEndian));
          break;
        case 12:
          values.push(view.getFloat64(pos, littleEndian));
          break;
        default:
          values.push(view.getUint8(pos));
      }
    }
    return values.length === 1 ? values[0] : values;
  }

  function parseIfd(ifdRelativeOffset, dict, targetObj) {
    const dirStart = tiffStart + ifdRelativeOffset;
    if (dirStart + 2 > view.byteLength) return 0;
    const numEntries = view.getUint16(dirStart, littleEndian);
    if (numEntries > 500) return 0;

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = dirStart + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;

      const tagId = view.getUint16(entryOffset, littleEndian);
      const type = view.getUint16(entryOffset + 2, littleEndian);
      const count = view.getUint32(entryOffset + 4, littleEndian);
      const valueOffset = entryOffset + 8;

      const tagHex = `0x${tagId.toString(16).padStart(4, '0').toUpperCase()}`;
      const tagName = dict[tagId] || `UnknownTag_${tagHex}`;
      const val = readTagValue(type, count, valueOffset);

      targetObj[tagName] = {
        tagId: tagHex,
        type,
        count,
        value: val
      };
      result.rawTagCount++;

      if (tagId === 0x8769 && typeof val === 'number') {
        parseIfd(val, EXIF_TAGS, result.exifIfd);
      } else if (tagId === 0x8825 && typeof val === 'number') {
        parseIfd(val, GPS_TAGS, result.gpsIfd);
      } else if (tagId === 0xa005 && typeof val === 'number') {
        parseIfd(val, INTEROP_TAGS, result.interopIfd);
      }
    }

    const nextIfdPos = dirStart + 2 + numEntries * 12;
    if (nextIfdPos + 4 <= view.byteLength) {
      return view.getUint32(nextIfdPos, littleEndian);
    }
    return 0;
  }

  const nextIfdOffset = parseIfd(firstIfdOffset, EXIF_TAGS, result.ifd0);
  if (nextIfdOffset > 0 && nextIfdOffset < (maxLength || view.byteLength)) {
    parseIfd(nextIfdOffset, EXIF_TAGS, result.ifd1);
  }

  if (result.gpsIfd.GPSLatitude && result.gpsIfd.GPSLongitude) {
    try {
      const latVals = result.gpsIfd.GPSLatitude.value;
      const lonVals = result.gpsIfd.GPSLongitude.value;
      const latRef = result.gpsIfd.GPSLatitudeRef?.value || 'N';
      const lonRef = result.gpsIfd.GPSLongitudeRef?.value || 'E';
      if (Array.isArray(latVals) && latVals.length === 3 && Array.isArray(lonVals) && lonVals.length === 3) {
        let lat = latVals[0].decimal + latVals[1].decimal / 60 + latVals[2].decimal / 3600;
        let lon = lonVals[0].decimal + lonVals[1].decimal / 60 + lonVals[2].decimal / 3600;
        if (String(latRef).toUpperCase().startsWith('S')) lat = -lat;
        if (String(lonRef).toUpperCase().startsWith('W')) lon = -lon;
        result.gpsDecimal = {
          latitude: Number(lat.toFixed(7)),
          longitude: Number(lon.toFixed(7)),
          altitude: result.gpsIfd.GPSAltitude?.value?.decimal ?? null
        };
      }
    } catch (_) {}
  }

  return result;
}

function parseJpeg(view) {
  const jpegInfo = {
    format: 'JPEG',
    markers: [],
    frameInfo: null,
    jfif: null,
    exif: null,
    xmp: null,
    iccProfile: null,
    quantizationTables: 0,
    huffmanTables: 0,
    comments: [],
    entropyScanSizeBytes: 0
  };

  let offset = 2;
  jpegInfo.markers.push({
    marker: '0xFFD8',
    name: 'SOI (Start of Image)',
    offset: 0,
    length: 2
  });

  while (offset + 1 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) {
      offset++;
    }
    if (offset >= view.byteLength) break;

    const markerCode = view.getUint8(offset);
    offset++;

    if (markerCode === 0xd9) {
      jpegInfo.markers.push({
        marker: '0xFFD9',
        name: 'EOI (End of Image)',
        offset: offset - 2,
        length: 2
      });
      break;
    }

    if (markerCode === 0x00 || (markerCode >= 0xd0 && markerCode <= 0xd7)) {
      continue;
    }

    if (offset + 2 > view.byteLength) break;
    const segLength = view.getUint16(offset, false);
    const segStart = offset + 2;
    const markerHex = `0xFF${markerCode.toString(16).padStart(2, '0').toUpperCase()}`;
    const markerName = JPEG_MARKERS[markerCode] || `Marker_${markerHex}`;

    jpegInfo.markers.push({
      marker: markerHex,
      name: markerName,
      offset: offset - 2,
      length: segLength
    });

    if (markerCode === 0xe0 && segStart + 14 <= view.byteLength) {
      const id = readAscii(view, segStart, 5);
      if (id === 'JFIF') {
        const vMaj = view.getUint8(segStart + 5);
        const vMin = view.getUint8(segStart + 6);
        const units = view.getUint8(segStart + 7);
        const xDensity = view.getUint16(segStart + 8, false);
        const yDensity = view.getUint16(segStart + 10, false);
        const xThumb = view.getUint8(segStart + 12);
        const yThumb = view.getUint8(segStart + 13);
        jpegInfo.jfif = {
          identifier: 'JFIF',
          version: `${vMaj}.${String(vMin).padStart(2, '0')}`,
          densityUnits: units === 1 ? 'dots/inch (DPI)' : units === 2 ? 'dots/cm' : 'aspect ratio',
          xDensity,
          yDensity,
          thumbnailDimensions: `${xThumb}x${yThumb}`
        };
      }
    }

    if (markerCode === 0xe1 && segStart + 6 <= view.byteLength) {
      const header6 = readAscii(view, segStart, 6);
      if (header6 === 'Exif' && !jpegInfo.exif) {
        jpegInfo.exif = parseTiff(view, segStart + 6, segLength - 8);
      } else {
        const header29 = readAscii(view, segStart, 29);
        if (header29.includes('http://ns.adobe.com/xap/1.0/')) {
          const xmpStart = segStart + 29;
          const xmpLen = Math.max(0, segLength - 2 - 29);
          jpegInfo.xmp = readAscii(view, xmpStart, Math.min(xmpLen, 8192));
        }
      }
    }

    if (markerCode === 0xe2 && segStart + 14 <= view.byteLength) {
      const iccId = readAscii(view, segStart, 12);
      if (iccId === 'ICC_PROFILE') {
        const chunkNum = view.getUint8(segStart + 12);
        const totalChunks = view.getUint8(segStart + 13);
        const profStart = segStart + 14;
        if (chunkNum === 1 && profStart + 36 <= view.byteLength) {
          const profileSize = view.getUint32(profStart, false);
          const cmmType = readAscii(view, profStart + 4, 4);
          const colorSpace = readAscii(view, profStart + 16, 4);
          const pcs = readAscii(view, profStart + 20, 4);
          const platform = readAscii(view, profStart + 40, 4);
          jpegInfo.iccProfile = {
            profileSize,
            cmmType,
            colorSpace: colorSpace.trim(),
            connectionSpace: pcs.trim(),
            platform: platform.trim(),
            chunks: `${chunkNum}/${totalChunks}`
          };
        }
      }
    }

    if (markerCode === 0xdb) jpegInfo.quantizationTables++;
    if (markerCode === 0xc4) jpegInfo.huffmanTables++;

    if (markerCode >= 0xc0 && markerCode <= 0xc3 && segStart + 6 <= view.byteLength) {
      const precision = view.getUint8(segStart);
      const height = view.getUint16(segStart + 1, false);
      const width = view.getUint16(segStart + 3, false);
      const numComponents = view.getUint8(segStart + 5);
      const components = [];
      for (let c = 0; c < numComponents; c++) {
        const cPos = segStart + 6 + c * 3;
        if (cPos + 3 <= view.byteLength) {
          const id = view.getUint8(cPos);
          const sampling = view.getUint8(cPos + 1);
          const hSamp = (sampling >> 4) & 0x0f;
          const vSamp = sampling & 0x0f;
          const qTable = view.getUint8(cPos + 2);
          components.push({ id, hSampling: hSamp, vSampling: vSamp, quantTableId: qTable });
        }
      }
      let chromaSubsampling = 'Unknown';
      if (components.length === 3) {
        const y = components[0];
        if (y.hSampling === 1 && y.vSampling === 1) chromaSubsampling = '4:4:4 (No Subsampling / Full Chroma)';
        else if (y.hSampling === 2 && y.vSampling === 1) chromaSubsampling = '4:2:2 (Horizontal Subsampling)';
        else if (y.hSampling === 2 && y.vSampling === 2) chromaSubsampling = '4:2:0 (Standard YCbCr)';
      } else if (components.length === 1) {
        chromaSubsampling = 'Monochrome (Grayscale)';
      }

      jpegInfo.frameInfo = {
        encodingProcess: JPEG_MARKERS[markerCode],
        bitsPerSample: precision,
        width,
        height,
        megapixels: Number(((width * height) / 1e6).toFixed(2)),
        colorComponents: numComponents,
        chromaSubsampling,
        components
      };
    }

    if (markerCode === 0xfe && segLength > 2) {
      jpegInfo.comments.push(readAscii(view, segStart, segLength - 2));
    }

    if (markerCode === 0xda) {
      const scanDataOffset = offset + segLength;
      jpegInfo.entropyScanSizeBytes = Math.max(0, view.byteLength - scanDataOffset - 2);
      break;
    }

    offset += segLength;
  }

  return jpegInfo;
}

function parsePng(view) {
  const pngInfo = {
    format: 'PNG',
    chunks: [],
    header: null,
    exif: null,
    textMetadata: {},
    physicalDimensions: null
  };

  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = readAscii(view, offset + 4, 4);
    const dataStart = offset + 8;

    pngInfo.chunks.push({ type, offset, length });

    if (type === 'IHDR' && dataStart + 13 <= view.byteLength) {
      const width = view.getUint32(dataStart, false);
      const height = view.getUint32(dataStart + 4, false);
      const bitDepth = view.getUint8(dataStart + 8);
      const colorType = view.getUint8(dataStart + 9);
      const colorTypes = {
        0: 'Grayscale',
        2: 'Truecolor (RGB)',
        3: 'Indexed-color',
        4: 'Grayscale with Alpha',
        6: 'Truecolor with Alpha (RGBA)'
      };
      pngInfo.header = {
        width,
        height,
        megapixels: Number(((width * height) / 1e6).toFixed(2)),
        bitDepth,
        colorType: colorTypes[colorType] || `Type ${colorType}`,
        interlace: view.getUint8(dataStart + 12) === 1 ? 'Adam7 Interlaced' : 'Non-interlaced'
      };
    } else if (type === 'eXIf' && dataStart + length <= view.byteLength) {
      pngInfo.exif = parseTiff(view, dataStart, length);
    } else if (type === 'tEXt' && dataStart + length <= view.byteLength) {
      const rawText = readAscii(view, dataStart, length);
      const [k, ...v] = rawText.split('\0');
      if (k) pngInfo.textMetadata[k] = v.join('');
    } else if (type === 'pHYs' && dataStart + 9 <= view.byteLength) {
      pngInfo.physicalDimensions = {
        pixelsPerUnitX: view.getUint32(dataStart, false),
        pixelsPerUnitY: view.getUint32(dataStart + 4, false),
        unit: view.getUint8(dataStart + 8) === 1 ? 'Meter' : 'Unknown'
      };
    }

    offset += 12 + length;
    if (type === 'IEND') break;
  }

  return pngInfo;
}

async function analyzeBinaryBuffer(buffer, mimeType = '') {
  const view = new DataView(buffer);
  const hashes = await computeHashes(buffer);
  const hexPreview = generateHexDump(buffer, 512);

  const summary = {
    byteLength: buffer.byteLength,
    sizeFormatted: `${(buffer.byteLength / 1024).toFixed(2)} KB (${buffer.byteLength.toLocaleString()} bytes)`,
    mimeType,
    hashes,
    signatureHex: bytesToHex(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)), 16),
    detectedContainer: 'Unknown Binary',
    containerDetails: null,
    hexDumpFirst512Bytes: hexPreview
  };

  if (buffer.byteLength >= 2 && view.getUint16(0, false) === 0xffd8) {
    summary.detectedContainer = 'JPEG (Joint Photographic Experts Group)';
    summary.containerDetails = parseJpeg(view);
  } else if (
    buffer.byteLength >= 8 &&
    view.getUint32(0, false) === 0x89504e47 &&
    view.getUint32(4, false) === 0x0d0a1a0a
  ) {
    summary.detectedContainer = 'PNG (Portable Network Graphics - Lossless)';
    summary.containerDetails = parsePng(view);
  } else if (
    buffer.byteLength >= 4 &&
    (view.getUint16(0, false) === 0x4949 || view.getUint16(0, false) === 0x4d4d)
  ) {
    summary.detectedContainer = 'TIFF / DNG Raw Image';
    summary.containerDetails = {
      format: 'TIFF/DNG',
      exif: parseTiff(view, 0, buffer.byteLength)
    };
  } else if (
    buffer.byteLength >= 12 &&
    readAscii(view, 0, 4) === 'RIFF' &&
    readAscii(view, 8, 4) === 'WEBP'
  ) {
    summary.detectedContainer = 'WebP Container';
    summary.containerDetails = { format: 'WebP', fileSize: view.getUint32(4, true) + 8 };
  } else if (buffer.byteLength >= 12 && readAscii(view, 4, 4) === 'ftyp') {
    const majorBrand = readAscii(view, 8, 4);
    summary.detectedContainer = `ISO BMFF / HEIF / MP4 (Brand: ${majorBrand})`;
  }

  return summary;
}

/**
 * Generates an authentic Mobile Smartphone Filename (e.g., PXL_20261108_061522481.jpg or 20261108_061522.jpg).
 */
function formatMobileFilename(profileId, dateObj = new Date(), ext = 'jpg') {
  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  const hh = pad2(dateObj.getHours());
  const mm = pad2(dateObj.getMinutes());
  const ss = pad2(dateObj.getSeconds());
  const ms = pad3(dateObj.getMilliseconds());

  if (profileId && profileId.startsWith('pixel')) {
    return `PXL_${y}${m}${d}_${hh}${mm}${ss}${ms}.${ext}`;
  }
  if (profileId === 'samsung_s24_ultra') {
    return `${y}${m}${d}_${hh}${mm}${ss}.${ext}`;
  }
  if (profileId === 'iphone_16_pro') {
    const num = 1000 + (Math.floor(dateObj.getTime() / 1000) % 8999);
    return `IMG_${num}.${ext.toUpperCase()}`;
  }
  return `IMG_${y}${m}${d}_${hh}${mm}${ss}.${ext}`;
}

/**
 * Builds an authentic, Real Mobile Camera EXIF APP1 block (IFD0 + ExifSubIFD + InteropIFD + GPSIFD + IFD1 Embedded Thumbnail)
 * and losslessly injects it at byte offset 0x0002 (immediately after SOI FF D8), stripping synthetic JFIF APP0 headers
 * so the file structure matches a real smartphone camera JPEG 100% while preserving the raw compressed JPEG scan data.
 */
function buildAndInjectLosslessExif(rawJpegBuffer, metadataPayload = {}) {
  const srcBytes = new Uint8Array(rawJpegBuffer);
  if (srcBytes.length < 4 || srcBytes[0] !== 0xff || srcBytes[1] !== 0xd8) {
    return rawJpegBuffer;
  }

  const profileKey = metadataPayload.mobileProfileId || 'pixel_10';
  const baseProfile = MOBILE_PROFILES[profileKey] || MOBILE_PROFILES.pixel_10;

  const makeStr = metadataPayload.customMake || baseProfile.make;
  const modelStr = metadataPayload.customModel || baseProfile.model;
  const softwareStr = metadataPayload.customSoftware || baseProfile.software;
  const lensMakeStr = metadataPayload.customLensMake || baseProfile.lensMake;
  const lensModelStr = metadataPayload.customLensModel || baseProfile.lensModel;

  const fNumPair = metadataPayload.customFNumber || baseProfile.fNumber; // [num, den]
  const focalPair = metadataPayload.customFocalLength || baseProfile.focalLength; // [num, den]
  const focal35mm = metadataPayload.customFocal35mm || baseProfile.focalLength35mm;
  const lensSpec4 = baseProfile.lensSpec;

  const now = new Date(metadataPayload.timestampIso || Date.now());
  const pad2 = n => String(n).padStart(2, '0');
  const exifDateStr = `${now.getFullYear()}:${pad2(now.getMonth() + 1)}:${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const gpsDateStr = `${now.getUTCFullYear()}:${pad2(now.getUTCMonth() + 1)}:${pad2(now.getUTCDate())}`;
  const subSecStr = String(now.getMilliseconds()).padStart(3, '0') + '482';

  // Format timezone offset like "+06:00"
  const tzOffsetMin = -now.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const tzAbs = Math.abs(tzOffsetMin);
  const offsetTimeStr = `${tzSign}${pad2(Math.floor(tzAbs / 60))}:${pad2(tzAbs % 60)}`;

  const trackSettings = metadataPayload.trackSettings || {};
  const width = metadataPayload.width || trackSettings.width || 4080;
  const height = metadataPayload.height || trackSettings.height || 3072;

  const iso = Math.round(
    metadataPayload.customIso ||
    (trackSettings.iso && trackSettings.iso > 0 ? trackSettings.iso : baseProfile.defaultIso)
  );

  let expNum = baseProfile.defaultExposure[0];
  let expDen = baseProfile.defaultExposure[1];
  if (metadataPayload.customExposureDen) {
    expNum = 1;
    expDen = Math.max(1, Math.round(metadataPayload.customExposureDen));
  } else if (trackSettings.exposureTime && trackSettings.exposureTime > 0) {
    const expSec = trackSettings.exposureTime > 10 ? trackSettings.exposureTime / 1e6 : trackSettings.exposureTime;
    expNum = expSec < 1 ? 1 : Math.round(expSec * 1000);
    expDen = expSec < 1 ? Math.max(1, Math.round(1 / expSec)) : 1000;
  }

  // Calculate exact APEX ShutterSpeedValue = -log2(expNum / expDen) and ApertureValue = 2 * log2(FNumber)
  const expSecFloat = expNum / expDen;
  const fNumFloat = fNumPair[0] / fNumPair[1];
  const apexShutter = Math.round((-Math.log2(expSecFloat)) * 100);
  const apexAperture = Math.round((2 * Math.log2(fNumFloat)) * 100);
  const apexBrightness = Math.round((apexAperture / 100 + apexShutter / 100 - Math.log2(iso / 3.125)) * 100);

  // Generate a 32-char hex ImageUniqueID
  const uniqueIdHex = Array.from({ length: 32 }, (_, i) =>
    ((now.getTime() + i * 2654435761) & 0xf).toString(16)
  ).join('').toUpperCase();

  const dataHeap = [];
  let heapOffset = 0;

  function align2(len) {
    return len % 2 === 1 ? len + 1 : len;
  }

  function encodeAsciiBytes(str) {
    const clean = String(str).replace(/[^\x20-\x7E]/g, '_') + '\0';
    const len = align2(clean.length);
    const u8 = new Uint8Array(len);
    for (let i = 0; i < clean.length; i++) u8[i] = clean.charCodeAt(i);
    return { bytes: u8, count: clean.length };
  }

  function encodeRational(num, den) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setUint32(0, Math.max(0, Math.round(num)), false);
    dv.setUint32(4, Math.max(1, Math.round(den)), false);
    return new Uint8Array(buf);
  }

  function encodeSRational(num, den) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    dv.setInt32(0, Math.round(num), false);
    dv.setInt32(4, Math.max(1, Math.round(den)), false);
    return new Uint8Array(buf);
  }

  function encodeMultiRational(pairs) {
    const buf = new ArrayBuffer(pairs.length * 8);
    const dv = new DataView(buf);
    pairs.forEach(([n, d], idx) => {
      dv.setUint32(idx * 8, Math.max(0, Math.round(n)), false);
      dv.setUint32(idx * 8 + 4, Math.max(1, Math.round(d)), false);
    });
    return new Uint8Array(buf);
  }

  function decimalToDmsRationals(dec) {
    // Add natural sub-second micro-jitter if exact integer/2-decimal so DMS looks like real hardware GPS chip
    let val = Math.abs(dec);
    if ( Number(val.toFixed(2)) === val ) {
      val += 0.0004271;
    }
    const deg = Math.floor(val);
    const minFloat = (val - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60 * 10000);
    return encodeMultiRational([
      [deg, 1],
      [min, 1],
      [sec, 10000]
    ]);
  }

  const gps = metadataPayload.geolocation;
  const hasGps = gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number';

  // Optional embedded JPEG thumbnail bytes for IFD1
  const thumbBytes = metadataPayload.thumbnailJpegBytes
    ? new Uint8Array(metadataPayload.thumbnailJpegBytes)
    : null;
  const hasThumb = thumbBytes && thumbBytes.byteLength > 0 && thumbBytes.byteLength < 48000;

  // 1. IFD0 Specification (Real Smartphone Primary Tags)
  const ifd0Spec = [
    { tag: 0x0100, type: 4, longVal: width },                   // ImageWidth
    { tag: 0x0101, type: 4, longVal: height },                  // ImageLength
    { tag: 0x010f, type: 2, ascii: makeStr },                   // Make
    { tag: 0x0110, type: 2, ascii: modelStr },                  // Model
    { tag: 0x0112, type: 3, shortVal: 1 },                      // Orientation = 1 (Horizontal/Normal)
    { tag: 0x011a, type: 5, rational: [72, 1] },                // XResolution = 72 dpi
    { tag: 0x011b, type: 5, rational: [72, 1] },                // YResolution = 72 dpi
    { tag: 0x0128, type: 3, shortVal: 2 },                      // ResolutionUnit = 2 (Inches)
    { tag: 0x0131, type: 2, ascii: softwareStr },               // Software (Mobile OS / HDR+ Build)
    { tag: 0x0132, type: 2, ascii: exifDateStr },               // DateTime
    { tag: 0x0213, type: 3, shortVal: 1 },                      // YCbCrPositioning = 1 (Centered)
    { tag: 0x8769, type: 4, isExifPointer: true }               // ExifIFDPointer
  ];
  if (hasGps) {
    ifd0Spec.push({ tag: 0x8825, type: 4, isGpsPointer: true }); // GPSInfoIFDPointer
  }
  ifd0Spec.sort((a, b) => a.tag - b.tag);

  // 2. Exif SubIFD Specification (39+ Real Mobile Camera Sensor Tags)
  const exifIfdSpec = [
    { tag: 0x829a, type: 5, rational: [expNum, expDen] },                        // ExposureTime
    { tag: 0x829d, type: 5, rational: fNumPair },                                // FNumber
    { tag: 0x8822, type: 3, shortVal: 2 },                                       // ExposureProgram = 2 (Normal program)
    { tag: 0x8827, type: 3, shortVal: Math.min(65535, Math.max(25, iso)) },      // ISOSpeedRatings
    { tag: 0x8830, type: 3, shortVal: 1 },                                       // SensitivityType = 1 (Standard Output Sensitivity)
    { tag: 0x8832, type: 4, longVal: iso },                                      // RecommendedExposureIndex
    { tag: 0x9000, type: 7, inline4: [0x30, 0x32, 0x33, 0x32], count: 4 },       // ExifVersion = "0232"
    { tag: 0x9003, type: 2, ascii: exifDateStr },                                // DateTimeOriginal
    { tag: 0x9004, type: 2, ascii: exifDateStr },                                // DateTimeDigitized
    { tag: 0x9010, type: 2, ascii: offsetTimeStr },                              // OffsetTime
    { tag: 0x9011, type: 2, ascii: offsetTimeStr },                              // OffsetTimeOriginal
    { tag: 0x9012, type: 2, ascii: offsetTimeStr },                              // OffsetTimeDigitized
    { tag: 0x9101, type: 7, inline4: [1, 2, 3, 0], count: 4 },                   // ComponentsConfiguration = YCbCr
    { tag: 0x9201, type: 10, srational: [apexShutter, 100] },                    // ShutterSpeedValue (APEX)
    { tag: 0x9202, type: 5, rational: [apexAperture, 100] },                     // ApertureValue (APEX)
    { tag: 0x9203, type: 10, srational: [apexBrightness, 100] },                 // BrightnessValue (APEX)
    { tag: 0x9204, type: 10, srational: [0, 100] },                              // ExposureBiasValue = 0 EV
    { tag: 0x9205, type: 5, rational: baseProfile.maxApertureApex },             // MaxApertureValue
    { tag: 0x9206, type: 5, rational: [480, 1000] },                             // SubjectDistance = 0.48 m
    { tag: 0x9207, type: 3, shortVal: 2 },                                       // MeteringMode = 2 (CenterWeightedAverage)
    { tag: 0x9208, type: 3, shortVal: 0 },                                       // LightSource = 0 (Unknown / Auto)
    { tag: 0x9209, type: 3, shortVal: 16 },                                      // Flash = 16 (Off, did not fire)
    { tag: 0x920a, type: 5, rational: focalPair },                               // FocalLength
    { tag: 0x9290, type: 2, ascii: subSecStr },                                  // SubSecTime
    { tag: 0x9291, type: 2, ascii: subSecStr },                                  // SubSecTimeOriginal
    { tag: 0x9292, type: 2, ascii: subSecStr },                                  // SubSecTimeDigitized
    { tag: 0xa000, type: 7, inline4: [0x30, 0x31, 0x30, 0x30], count: 4 },       // FlashpixVersion = "0100"
    { tag: 0xa001, type: 3, shortVal: 1 },                                       // ColorSpace = 1 (sRGB)
    { tag: 0xa002, type: 4, longVal: width },                                    // PixelXDimension
    { tag: 0xa003, type: 4, longVal: height },                                   // PixelYDimension
    { tag: 0xa005, type: 4, isInteropPointer: true },                            // InteroperabilityIFDPointer
    { tag: 0xa217, type: 3, shortVal: 2 },                                       // SensingMethod = 2 (One-chip color area sensor)
    { tag: 0xa300, type: 7, inline4: [3, 0, 0, 0], count: 1 },                   // FileSource = 3 (DSC)
    { tag: 0xa301, type: 7, inline4: [1, 0, 0, 0], count: 1 },                   // SceneType = 1 (Directly photographed)
    { tag: 0xa401, type: 3, shortVal: 1 },                                       // CustomRendered = 1 (HDR+)
    { tag: 0xa402, type: 3, shortVal: 0 },                                       // ExposureMode = 0 (Auto)
    { tag: 0xa403, type: 3, shortVal: 0 },                                       // WhiteBalance = 0 (Auto)
    { tag: 0xa404, type: 5, rational: [100, 100] },                              // DigitalZoomRatio = 1.0
    { tag: 0xa405, type: 3, shortVal: focal35mm },                               // FocalLengthIn35mmFilm
    { tag: 0xa406, type: 3, shortVal: 0 },                                       // SceneCaptureType = 0 (Standard)
    { tag: 0xa408, type: 3, shortVal: 0 },                                       // Contrast = 0 (Normal)
    { tag: 0xa409, type: 3, shortVal: 0 },                                       // Saturation = 0 (Normal)
    { tag: 0xa40a, type: 3, shortVal: 0 },                                       // Sharpness = 0 (Normal)
    { tag: 0xa40c, type: 3, shortVal: 2 },                                       // SubjectDistanceRange = 2 (Close/Macro/Standard)
    { tag: 0xa420, type: 2, ascii: uniqueIdHex },                                // ImageUniqueID
    { tag: 0xa432, type: 5, rawBytes: encodeMultiRational(lensSpec4), count: 4 }, // LensSpecification
    { tag: 0xa433, type: 2, ascii: lensMakeStr },                                // LensMake
    { tag: 0xa434, type: 2, ascii: lensModelStr }                                // LensModel
  ];
  exifIfdSpec.sort((a, b) => a.tag - b.tag);

  // 3. Interoperability IFD Specification (R98 Standard)
  const interopIfdSpec = [
    { tag: 0x0001, type: 2, ascii: 'R98' },                                      // InteroperabilityIndex
    { tag: 0x0002, type: 7, inline4: [0x30, 0x31, 0x30, 0x30], count: 4 }        // InteroperabilityVersion = "0100"
  ];

  // 4. GPS IFD Specification
  const gpsIfdSpec = [];
  if (hasGps) {
    const latRef = gps.latitude >= 0 ? 'N' : 'S';
    const lonRef = gps.longitude >= 0 ? 'E' : 'W';
    const altVal = gps.altitude !== null && gps.altitude !== undefined ? Math.abs(gps.altitude) : 19.4;
    const gpsProcBytes = new Uint8Array([0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00, 0x47, 0x50, 0x53, 0x00]); // "ASCII\0\0\0GPS\0"

    gpsIfdSpec.push(
      { tag: 0x0000, type: 1, inline4: [2, 2, 0, 0], count: 4 },                 // GPSVersionID = 2.2.0.0
      { tag: 0x0001, type: 2, ascii: latRef },                                   // GPSLatitudeRef
      { tag: 0x0002, type: 5, rawBytes: decimalToDmsRationals(gps.latitude), count: 3 }, // GPSLatitude
      { tag: 0x0003, type: 2, ascii: lonRef },                                   // GPSLongitudeRef
      { tag: 0x0004, type: 5, rawBytes: decimalToDmsRationals(gps.longitude), count: 3 }, // GPSLongitude
      { tag: 0x0005, type: 1, inline4: [0, 0, 0, 0], count: 1 },                 // GPSAltitudeRef = Above Sea Level
      { tag: 0x0006, type: 5, rational: [Math.round(altVal * 100), 100] },       // GPSAltitude
      { tag: 0x0007, type: 5, rawBytes: encodeMultiRational([                    // GPSTimeStamp (UTC)
        [now.getUTCHours(), 1],
        [now.getUTCMinutes(), 1],
        [now.getUTCSeconds(), 1]
      ]), count: 3 },
      { tag: 0x0010, type: 2, ascii: 'M' },                                      // GPSImgDirectionRef = Magnetic North
      { tag: 0x0011, type: 5, rational: [184, 1] },                              // GPSImgDirection
      { tag: 0x001b, type: 7, rawBytes: gpsProcBytes, count: 11 },               // GPSProcessingMethod = GPS
      { tag: 0x001d, type: 2, ascii: gpsDateStr }                                // GPSDateStamp
    );
    gpsIfdSpec.sort((a, b) => a.tag - b.tag);
  }

  // 5. IFD1 Specification (Embedded JPEG Thumbnail)
  const ifd1Spec = [];
  if (hasThumb) {
    ifd1Spec.push(
      { tag: 0x0103, type: 3, shortVal: 6 },                                     // Compression = 6 (JPEG)
      { tag: 0x0112, type: 3, shortVal: 1 },                                     // Orientation = 1
      { tag: 0x011a, type: 5, rational: [72, 1] },                               // XResolution
      { tag: 0x011b, type: 5, rational: [72, 1] },                               // YResolution
      { tag: 0x0128, type: 3, shortVal: 2 },                                     // ResolutionUnit = 2
      { tag: 0x0201, type: 4, isThumbOffset: true },                             // JPEGInterchangeFormat
      { tag: 0x0202, type: 4, longVal: thumbBytes.byteLength }                   // JPEGInterchangeFormatLength
    );
    ifd1Spec.sort((a, b) => a.tag - b.tag);
  }

  // Compute exact section offsets from start of TIFF header (0):
  const ifd0Offset = 8;
  const ifd0Size = 2 + ifd0Spec.length * 12 + 4;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const exifIfdSize = 2 + exifIfdSpec.length * 12 + 4;
  const interopIfdOffset = exifIfdOffset + exifIfdSize;
  const interopIfdSize = 2 + interopIfdSpec.length * 12 + 4;
  const gpsIfdOffset = interopIfdOffset + interopIfdSize;
  const gpsIfdSize = hasGps ? (2 + gpsIfdSpec.length * 12 + 4) : 0;
  const ifd1Offset = gpsIfdOffset + gpsIfdSize;
  const ifd1Size = hasThumb ? (2 + ifd1Spec.length * 12 + 4) : 0;
  const dataPoolStart = ifd1Offset + ifd1Size;

  function allocateData(u8) {
    const alignedLen = align2(u8.byteLength);
    let buf = u8;
    if (alignedLen !== u8.byteLength) {
      buf = new Uint8Array(alignedLen);
      buf.set(u8, 0);
    }
    const ptr = dataPoolStart + heapOffset;
    dataHeap.push(buf);
    heapOffset += buf.byteLength;
    return ptr;
  }

  function serializeIfd(specList, nextIfdPointer = 0) {
    const buf = new ArrayBuffer(2 + specList.length * 12 + 4);
    const dv = new DataView(buf);
    dv.setUint16(0, specList.length, false);
    specList.forEach((item, idx) => {
      const pos = 2 + idx * 12;
      dv.setUint16(pos, item.tag, false);
      dv.setUint16(pos + 2, item.type, false);

      if (item.isExifPointer) {
        dv.setUint32(pos + 4, 1, false);
        dv.setUint32(pos + 8, exifIfdOffset, false);
      } else if (item.isGpsPointer) {
        dv.setUint32(pos + 4, 1, false);
        dv.setUint32(pos + 8, gpsIfdOffset, false);
      } else if (item.isInteropPointer) {
        dv.setUint32(pos + 4, 1, false);
        dv.setUint32(pos + 8, interopIfdOffset, false);
      } else if (item.isThumbOffset) {
        dv.setUint32(pos + 4, 1, false);
        const thumbPtr = allocateData(thumbBytes);
        dv.setUint32(pos + 8, thumbPtr, false);
      } else if (item.type === 3 && item.shortVal !== undefined) {
        dv.setUint32(pos + 4, 1, false);
        dv.setUint16(pos + 8, item.shortVal, false);
        dv.setUint16(pos + 10, 0, false);
      } else if (item.type === 4 && item.longVal !== undefined) {
        dv.setUint32(pos + 4, 1, false);
        dv.setUint32(pos + 8, item.longVal, false);
      } else if (item.inline4) {
        dv.setUint32(pos + 4, item.count || 4, false);
        for (let b = 0; b < 4; b++) dv.setUint8(pos + 8 + b, item.inline4[b] || 0);
      } else if (item.ascii !== undefined) {
        const enc = encodeAsciiBytes(item.ascii);
        dv.setUint32(pos + 4, enc.count, false);
        if (enc.count <= 4) {
          for (let b = 0; b < enc.count; b++) dv.setUint8(pos + 8 + b, enc.bytes[b]);
        } else {
          const ptr = allocateData(enc.bytes);
          dv.setUint32(pos + 8, ptr, false);
        }
      } else if (item.rational) {
        dv.setUint32(pos + 4, 1, false);
        const rBytes = encodeRational(item.rational[0], item.rational[1]);
        const ptr = allocateData(rBytes);
        dv.setUint32(pos + 8, ptr, false);
      } else if (item.srational) {
        dv.setUint32(pos + 4, 1, false);
        const srBytes = encodeSRational(item.srational[0], item.srational[1]);
        const ptr = allocateData(srBytes);
        dv.setUint32(pos + 8, ptr, false);
      } else if (item.rawBytes) {
        dv.setUint32(pos + 4, item.count, false);
        const ptr = allocateData(item.rawBytes);
        dv.setUint32(pos + 8, ptr, false);
      }
    });
    dv.setUint32(2 + specList.length * 12, nextIfdPointer, false);
    return new Uint8Array(buf);
  }

  const ifd0Bytes = serializeIfd(ifd0Spec, hasThumb ? ifd1Offset : 0);
  const exifIfdBytes = serializeIfd(exifIfdSpec, 0);
  const interopIfdBytes = serializeIfd(interopIfdSpec, 0);
  const gpsIfdBytes = hasGps ? serializeIfd(gpsIfdSpec, 0) : new Uint8Array(0);
  const ifd1Bytes = hasThumb ? serializeIfd(ifd1Spec, 0) : new Uint8Array(0);

  const tiffTotalLen = dataPoolStart + heapOffset;
  const app1PayloadLen = 6 + tiffTotalLen; // "Exif\0\0" + TIFF
  const app1SegmentLen = 2 + app1PayloadLen;
  const app1Full = new Uint8Array(2 + app1SegmentLen);
  const app1View = new DataView(app1Full.buffer);

  app1Full[0] = 0xff;
  app1Full[1] = 0xe1;
  app1View.setUint16(2, app1SegmentLen, false);
  app1Full.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 4); // "Exif\0\0"
  app1Full.set([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], 10); // TIFF Big Endian Header

  let writeCursor = 18;
  app1Full.set(ifd0Bytes, writeCursor);
  writeCursor += ifd0Bytes.byteLength;
  app1Full.set(exifIfdBytes, writeCursor);
  writeCursor += exifIfdBytes.byteLength;
  app1Full.set(interopIfdBytes, writeCursor);
  writeCursor += interopIfdBytes.byteLength;
  if (hasGps) {
    app1Full.set(gpsIfdBytes, writeCursor);
    writeCursor += gpsIfdBytes.byteLength;
  }
  if (hasThumb) {
    app1Full.set(ifd1Bytes, writeCursor);
    writeCursor += ifd1Bytes.byteLength;
  }
  for (const chunk of dataHeap) {
    app1Full.set(chunk, writeCursor);
    writeCursor += chunk.byteLength;
  }

  // Strip browser-generated APP0 (JFIF) or old APP1 (EXIF) at start of JPEG so that
  // the resulting file starts with FF D8 FF E1 ... "Exif\0\0" just like a real smartphone photo!
  let bodyStartOffset = 2;
  while (bodyStartOffset + 4 <= srcBytes.length && srcBytes[bodyStartOffset] === 0xff) {
    const marker = srcBytes[bodyStartOffset + 1];
    const segLen = (srcBytes[bodyStartOffset + 2] << 8) | srcBytes[bodyStartOffset + 3];
    if (marker === 0xe0 || marker === 0xe1) {
      // Skip JFIF APP0 or previous APP1
      bodyStartOffset += 2 + segLen;
    } else {
      break;
    }
  }

  const remainingBody = srcBytes.subarray(bodyStartOffset);
  const outBytes = new Uint8Array(2 + app1Full.byteLength + remainingBody.byteLength);
  outBytes[0] = 0xff;
  outBytes[1] = 0xd8;
  outBytes.set(app1Full, 2);
  outBytes.set(remainingBody, 2 + app1Full.byteLength);

  return outBytes.buffer;
}

const ExportedEngine = {
  MOBILE_PROFILES,
  analyzeBinaryBuffer,
  buildAndInjectLosslessExif,
  formatMobileFilename,
  computeHashes,
  generateHexDump
};

if (typeof window !== 'undefined') {
  window.ForensicExifEngine = ExportedEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportedEngine;
}
