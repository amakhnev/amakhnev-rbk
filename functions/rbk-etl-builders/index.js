import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import pkg from 'pg';
const { Client } = pkg;
import csv from 'csv-parser';
import { Readable } from 'stream';
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_ENDPOINT,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
};

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  try {
    console.log("Ready to get data from "+JSON.stringify({ Bucket: bucket, Key: key }))
    const data = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    console.log("Data loaded!")

    const bodyContents = await streamToString(data.Body);
    const results = await parseCSV(bodyContents);

    const client = new Client(dbConfig);
    await client.connect();

    for (const result of results) {
      await upsertBuilder(client, result.builder, result.marketTypes);
    }

    await client.end();
    return { statusCode: 200, body: 'Successfully updated builders and builder_market_types tables.' };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: 'Failed to update database.' };
  }
};

const streamToString = (stream) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};

const parseCSV = (content) => {
  return new Promise((resolve, reject) => {
    const results = [];
    Readable.from(content)
      .pipe(csv({ separator: '|' }))
      .on('data', (data) => results.push({ builder: data.Builder, marketTypes: data['Market Type'].split(',') }))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const upsertBuilder = async (client, builderName, marketTypes) => {
  let builderId;

  const builderRes = await client.query('SELECT id FROM builders WHERE name = $1', [builderName]);
  if (builderRes.rows.length > 0) {
    builderId = builderRes.rows[0].id;
  } else {
    const insertRes = await client.query('INSERT INTO builders (name) VALUES ($1) RETURNING id', [builderName]);
    builderId = insertRes.rows[0].id;
  }

  await client.query('DELETE FROM builder_market_types WHERE builder_id = $1', [builderId]);

  for (const marketType of marketTypes) {
    const trimmedMarketType = marketType.trim();
    const marketTypeRes = await client.query('SELECT id FROM market_types WHERE type = $1', [trimmedMarketType]);
    if (marketTypeRes.rows.length > 0) {
      const marketTypeId = marketTypeRes.rows[0].id;
      await client.query('INSERT INTO builder_market_types (builder_id, market_type_id) VALUES ($1, $2)', [builderId, marketTypeId]);
    }
  }
};
