#!/bin/bash
# Quick API test script
# Usage: ./scripts/test-api.sh

BASE_URL="http://localhost:3001"

# Check if jq is available, otherwise use cat
if command -v jq &> /dev/null; then
    JSON_FORMAT="jq ."
else
    JSON_FORMAT="cat"
    echo "⚠️  Note: jq not found. Install it for prettier JSON output: https://stedolan.github.io/jq/download/"
    echo ""
fi

echo "🧪 Testing Gaming Leaderboard API"
echo "=================================="
echo ""

echo "1️⃣  Testing Health Check..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "✅ Health check passed"
else
    echo "❌ Server might not be running (HTTP $HTTP_CODE)"
fi
echo ""
echo ""

echo "2️⃣  Getting Game Modes..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/game-modes")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "✅ Game modes retrieved"
else
    echo "❌ Failed (HTTP $HTTP_CODE)"
fi
echo ""
echo ""

echo "3️⃣  Submitting Test Scores..."
# Use unique player IDs with timestamp to avoid rate limiting
TIMESTAMP=$(date +%s)
P1_ID="test-p1-$TIMESTAMP"
P2_ID="test-p2-$TIMESTAMP"
P3_ID="test-p3-$TIMESTAMP"

echo "   Submitting score for player1..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/scores/submit" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$P1_ID\",\"username\":\"alice\",\"gameMode\":1,\"score\":10000,\"gameDurationSeconds\":300}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "202" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "   ✅ Score submitted"
else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
sleep 1

echo "   Submitting score for player2..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/scores/submit" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$P2_ID\",\"username\":\"bob\",\"gameMode\":1,\"score\":8000,\"gameDurationSeconds\":300}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "202" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "   ✅ Score submitted"
else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
sleep 1

echo "   Submitting score for player3..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/scores/submit" \
  -H "Content-Type: application/json" \
  -d "{\"playerId\":\"$P3_ID\",\"username\":\"charlie\",\"gameMode\":1,\"score\":12000,\"gameDurationSeconds\":300}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "202" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "   ✅ Score submitted"
else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
sleep 2
echo ""
echo ""

echo "4️⃣  Getting Leaderboard..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/leaderboard/1?limit=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "✅ Leaderboard retrieved"
else
    echo "❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""
echo ""

echo "5️⃣  Getting Player Rank..."
# Use the first test player ID
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/players/$P1_ID/rank/1")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "✅ Player rank retrieved"
else
    echo "❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""
echo ""

echo "6️⃣  Getting Player Stats..."
# Use the first test player ID
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/players/$P1_ID/stats")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | $JSON_FORMAT
    echo "✅ Player stats retrieved"
else
    echo "❌ Failed (HTTP $HTTP_CODE)"
    echo "$BODY"
fi
echo ""
echo ""

echo "✅ Test complete!"

