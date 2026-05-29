// tflite_web_api_client is a browser-CDN gRPC-web client included in
// @tensorflow/tfjs-tflite's task library modules but absent from the npm dist.
// We only use loadTFLiteModel (not bert_qa / bert_nl_classifier), so an empty
// stub is safe — webpack can resolve the reference without pulling in CDN code.
exports.TFLiteWebAPIClient = class TFLiteWebAPIClient {};
