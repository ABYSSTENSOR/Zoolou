import Replicate from "replicate";
import { Configuration, OpenAIApi } from "openai";
import upsertPrediction from "../../../lib/upsertPrediction";

const WEBHOOK_HOST = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NGROK_HOST;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  if (req.body.source == "replicate") {
    console.log("host", WEBHOOK_HOST);
    const prediction = await replicate.predictions.create({
      input: { prompt: req.body.prompt },
      version: req.body.version,
      webhook: `${WEBHOOK_HOST}/api/replicate-webhook?submission_id=${req.body.submissionId}&model=${req.body.model}&source=${req.body.source}&anonID=${req.body.anonID}`,
      webhook_events_filter: ["start", "completed"],
    });

    if (prediction?.error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ detail: prediction.error }));
      return;
    }

    // upsertPrediction(
    //   prediction,
    //   req.body.model,
    //   req.body.source,
    //   req.body.anonID
    // );

    res.statusCode = 201;
    res.end(JSON.stringify(prediction));
  } else if (req.body.source == "openai") {
    const response = await openai.createImage({
      prompt: req.body.prompt,
      n: 1,
      size: "512x512",
    });

    const prediction = {
      id: req.body.predictionId,
      status: "completed",
      version: "dall-e",
      output: [response.data.data[0].url],
      input: { prompt: req.body.prompt },
      model: req.body.model,
      inserted_at: new Date(),
      created_at: new Date(),
      submissionId: req.body.submissionId,
    };

    upsertPrediction(
      prediction,
      req.body.model,
      req.body.source,
      req.body.anonID
    );

    res.statusCode = 201;
    res.end(JSON.stringify(prediction));
  }
}
