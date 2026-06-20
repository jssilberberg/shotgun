import { getState } from "../../serverless/shotgunGame.js";

export default function handler(_request, response) {
  response.status(200).json({ state: getState() });
}
