export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || ''
  res.status(200).json({
    hasBlobToken: token.length > 0,
    tokenPrefix: token.slice(0, 20),
    tokenLength: token.length,
    nodeEnv: process.env.NODE_ENV || 'undefined',
    vercelEnv: process.env.VERCEL_ENV || 'undefined',
  })
}
