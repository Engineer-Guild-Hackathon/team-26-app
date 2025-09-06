const express = require("express");
const helmet = require("helmet");

const app = express();

// セキュリティ系ヘッダ追加
app.use(helmet());
// JSON受け取り
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from backend!");
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});