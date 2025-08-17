const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Configuration, OpenAIApi } = require("openai");

admin.initializeApp();
const db = admin.firestore();

// Authenticate middleware
async function authenticate(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) throw new Error("Missing token");
  return await admin.auth().verifyIdToken(token);
}

// 🧠 AI Task Assistant
exports.askAI = functions.https.onRequest(async (req, res) => {
  try {
    const config = new Configuration({ apiKey: functions.config().openai.key });
    const openai = new OpenAIApi(config);
    const prompt = req.body.prompt;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const result = completion.data.choices[0].message.content;
    res.json({ response: result });
  } catch (err) {
    console.error(err);
    res.status(500).send("AI error");
  }
});

// ✅ Save task
exports.saveTask = functions.https.onRequest(async (req, res) => {
  try {
    const user = await authenticate(req);
    const task = req.body;
    const ref = db.collection("users").doc(user.uid).collection("tasks");
    const saved = await ref.add(task);
    res.json({ id: saved.id });
  } catch (err) {
    console.error(err);
    res.status(401).send("Unauthorized");
  }
});

// 📤 Get tasks
exports.getTasks = functions.https.onRequest(async (req, res) => {
  try {
    const user = await authenticate(req);
    const snapshot = await db.collection("users").doc(user.uid).collection("tasks").get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (err) {
    res.status(401).send("Unauthorized");
  }
});

// 🔄 Update task
exports.updateTask = functions.https.onRequest(async (req, res) => {
  try {
    const user = await authenticate(req);
    const { id, updates } = req.body;
    const ref = db.collection("users").doc(user.uid).collection("tasks").doc(id);
    await ref.update(updates);
    res.send("Updated");
  } catch (err) {
    res.status(401).send("Unauthorized");
  }
});
