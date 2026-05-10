import "dotenv/config";

const k = "AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED";
/** Suppress SDK "Node >= 22 after Jan 2027" noise on Node 20 unless set in .env. */
if (!(k in process.env)) {
  process.env[k] = "true";
}
