import type { ConditionModule } from "@daghe/shared";

export const cervicalViaModule: ConditionModule = {
  id: "cervical-via",
  version: "1.0.0",
  name: {
    en: "Cervical Cancer Screening (VIA)",
    ha: "Gwajin Cutar Mahaifa (VIA)",
    yo: "Ibojì Àrùn Ọgàn Obìnrin (VIA)",
    ig: "Nyocha Ọrịa Ahịhịa Nwanyị (VIA)",
    fr: "Dépistage du Cancer du Col (VIA)",
  },
  inputType: "camera-image",
  tfliteDetectionModel: "efficientdet-lite3-cervical-v1.2.tflite",
  tfliteClassificationModel: "mobilenetv2-cervical-via-v1.2.tflite",
  fallbackLogicPath: "/modules/cervical-via/fallback-logic.json",
  demoImages: [
    "/demo/via-positive.jpg",
    "/demo/via-negative.jpg",
    "/demo/via-indeterminate.jpg",
  ],
  blurThreshold: 100,
  exposureMin: 30,
  exposureMax: 220,
  roiConfidenceThreshold: 0.5,
  referenceTextPath: "/modules/cervical-via/reference/en.md",
};
