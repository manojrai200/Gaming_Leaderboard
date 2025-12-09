const https = require("https");
const http = require("http");
const { CDN_INVALIDATION_URL, CDN_API_KEY, CDN_PROVIDER } = require("../util/config");

/**
 * CDN Cache Service - Handles cache invalidation for CDN providers
 */

const invalidateCache = async (paths) => {
  if (!CDN_INVALIDATION_URL || !CDN_API_KEY) {
    // Silently skip if CDN is not configured (optional feature)
    return false;
  }

  try {
    const pathsArray = Array.isArray(paths) ? paths : [paths];
    
    if (CDN_PROVIDER === "cloudflare") {
      return await invalidateCloudflare(pathsArray);
    } else if (CDN_PROVIDER === "cloudfront") {
      return await invalidateCloudFront(pathsArray);
    } else if (CDN_PROVIDER === "fastly") {
      return await invalidateFastly(pathsArray);
    } else {
      console.log(`⚠️ Unknown CDN provider: ${CDN_PROVIDER}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Error invalidating CDN cache:", error);
    return false;
  }
};

const invalidateCloudflare = async (paths) => {
  // Cloudflare API v4
  const url = new URL(CDN_INVALIDATION_URL);
  const data = JSON.stringify({ files: paths });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CDN_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let responseData = "";
        res.on("data", (chunk) => (responseData += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ CDN cache invalidated for: ${paths.join(", ")}`);
            resolve(true);
          } else {
            console.error(`❌ CDN invalidation failed: ${res.statusCode} - ${responseData}`);
            resolve(false);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

const invalidateCloudFront = async (paths) => {
  // AWS CloudFront invalidation
  // Note: This requires AWS SDK - you'd need to install aws-sdk
  console.log("⚠️ CloudFront invalidation requires AWS SDK - not implemented");
  return false;
};

const invalidateFastly = async (paths) => {
  // Fastly API
  const url = new URL(CDN_INVALIDATION_URL);
  const data = JSON.stringify({ paths });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Fastly-Key": CDN_API_KEY,
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
      },
      (res) => {
        let responseData = "";
        res.on("data", (chunk) => (responseData += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ CDN cache invalidated for: ${paths.join(", ")}`);
            resolve(true);
          } else {
            console.error(`❌ CDN invalidation failed: ${res.statusCode} - ${responseData}`);
            resolve(false);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

module.exports = {
  invalidateCache,
};

