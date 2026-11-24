importScripts("zxing.min.js");

function productCode(text) {
  // Send only the GTIN to the catalogue. Keep the unit serial on the device.
  const value = text.match(/^(?:\]d2)?(?:\(01\)|\x1d?01)(\d{14})(?=$|[0-9(\x1d])/)?.[1];
  if (!value || !+value) return "";
  const sum = Array.from(value, Number).reduce((total, digit, i) => total + digit * (i % 2 ? 1 : 3), 0);
  if (sum % 10) return "";
  return value.startsWith("000000") ? value.slice(-8) : value.startsWith("0") ? value.slice(1) : value;
}

self.onmessage = ({data: {width, height, pixels}}) => {
  try {
    const format = ZXing.BarcodeFormat;
    const hints = new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,
      [format.EAN_13, format.EAN_8, format.UPC_A, format.UPC_E, format.DATA_MATRIX]]]);
    const source = new ZXing.RGBLuminanceSource(new Int32Array(pixels), width, height);
    const image = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const reader = new ZXing.MultiFormatReader();
    const result = reader.decode(image, hints);
    self.postMessage(result.getBarcodeFormat() === format.DATA_MATRIX ? productCode(result.getText()) : result.getText());
  } catch {
    self.postMessage("");
  }
};
