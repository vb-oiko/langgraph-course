import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from "pg";

import "dotenv/config"; // loads .env at startup

const embeddingFunction = new OpenAIEmbeddings();

const docs: Document[] = [
  new Document({
    pageContent:
      "Bella Vista is owned by Antonio Rossi, a renowned chef with over 20 years of experience in the culinary industry. He started Bella Vista to bring authentic Italian flavors to the community.",
    metadata: { source: "owner.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista offers a range of dishes with prices that cater to various budgets. Appetizers start at $8, main courses range from $15 to $35, and desserts are priced between $6 and $12.",
    metadata: { source: "dishes.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista is open from Monday to Sunday. Weekday hours are 11:00 AM to 10:00 PM, while weekend hours are extended from 11:00 AM to 11:00 PM.",
    metadata: { source: "restaurant_info.txt" },
  }),
  new Document({
    pageContent:
      "Bella Vista offers a variety of menus including a lunch menu, dinner menu, and a special weekend brunch menu. The lunch menu features light Italian fare, the dinner menu offers a more extensive selection of traditional and contemporary dishes, and the brunch menu includes both classic breakfast items and Italian specialties.",
    metadata: { source: "restaurant_info.txt" },
  }),
];

export const connectionString = process.env.NEON_DATABASE_URL;
export const poolConfig = {
  connectionString,
  ssl: true,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
export const BELLA_VISTA_DOCS_TABLE = "bella_vista_docs";

export const BELLA_VISTA_COLUMNS = {
  idColumnName: "id",
  vectorColumnName: "vector",
  contentColumnName: "content",
  metadataColumnName: "metadata",
} as const;

export async function seedBellaVistaDocEmbeddings() {
  // Neon database configuration

  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL environment variable is required");
  }

  // Create connection pool
  const pool = new Pool(poolConfig);

  // Check if table exists and has data
  const client = await pool.connect();

  // Check if table exists
  const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        );
      `;

  const tableExists = await client.query(tableExistsQuery, [
    BELLA_VISTA_DOCS_TABLE,
  ]);

  if (tableExists.rows[0].exists) {
    // Table exists, check if it has data
    const countQuery = `SELECT COUNT(*) FROM ${BELLA_VISTA_DOCS_TABLE};`;
    const countResult = await client.query(countQuery);
    const rowCount = parseInt(countResult.rows[0].count);

    if (rowCount > 0) {
      console.log(
        `Table '${BELLA_VISTA_DOCS_TABLE}' already contains ${rowCount} records. Skipping seed.`
      );
      client.release();
      await pool.end();
      return;
    }
  }

  console.log(`Seeding ${BELLA_VISTA_DOCS_TABLE} table...`);
  client.release();

  const vectorStore = await PGVectorStore.fromDocuments(
    docs,
    embeddingFunction,
    {
      pool,
      tableName: BELLA_VISTA_DOCS_TABLE,
      columns: BELLA_VISTA_COLUMNS,
    }
  );

  await vectorStore.end(); // automatically closes the pool as well

  console.log(
    `Successfully seeded ${BELLA_VISTA_DOCS_TABLE} table with embeddings.`
  );
}
