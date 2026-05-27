console.log("ENV CHECK:", process.env.NODE_ENV);
console.log("TOKEN EXISTS:", !!process.env.BOT_TOKEN);

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Partials
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* ========================= CONFIG ========================= */

const GUILD_ID = "1499919011217932310";
const ALLOWED_CHANNEL_ID = "1508184459013525624";

const factionRoles = {
  Fire: "1508184633999622376",
  Water: "1508185580033278103",
  Earth: "1508185255469907978",
  Wind: "1508185425821306891"
};

const REMOVE_ROLE_ID = "1500273203652726865";
const NEW_ROLE_ID = "1508912071851638824";

const sessions = new Map();
const activeLocks = new Set();

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ========================= QUIZ (UNCHANGED) ========================= */

const quiz = [
  {
    question: "When pressure builds, you usually:",
    options: [
      { text: "Push harder until it breaks", faction: "Fire" },
      { text: "Stay still and endure", faction: "Earth" },
      { text: "Feel it deeply before acting", faction: "Water" },
      { text: "Change direction instantly", faction: "Wind" }
    ]
  },
  {
    question: "What do you naturally protect most?",
    options: [
      { text: "Strength", faction: "Fire" },
      { text: "Stability", faction: "Earth" },
      { text: "Emotion", faction: "Water" },
      { text: "Freedom", faction: "Wind" }
    ]
  },
  {
    question: "In a group, you are usually:",
    options: [
      { text: "The leader", faction: "Fire" },
      { text: "The anchor", faction: "Earth" },
      { text: "The emotional core", faction: "Water" },
      { text: "The wildcard", faction: "Wind" }
    ]
  },
  {
    question: "Your energy feels most like:",
    options: [
      { text: "Fire", faction: "Fire" },
      { text: "Earth", faction: "Earth" },
      { text: "Water", faction: "Water" },
      { text: "Wind", faction: "Wind" }
    ]
  },
  {
    question: "What feels like failure to you?",
    options: [
      { text: "Weakness", faction: "Fire" },
      { text: "Collapse", faction: "Earth" },
      { text: "Emotional loss", faction: "Water" },
      { text: "Being trapped", faction: "Wind" }
    ]
  },
  {
    question: "Your decision style is:",
    options: [
      { text: "Fast and aggressive", faction: "Fire" },
      { text: "Slow and certain", faction: "Earth" },
      { text: "Emotional intuition", faction: "Water" },
      { text: "Fluid adaptation", faction: "Wind" }
    ]
  },
  {
    question: "People often misunderstand you as:",
    options: [
      { text: "Too intense", faction: "Fire" },
      { text: "Too rigid", faction: "Earth" },
      { text: "Too emotional", faction: "Water" },
      { text: "Too unpredictable", faction: "Wind" }
    ]
  },
  {
    question: "In silence, you become:",
    options: [
      { text: "Restless", faction: "Fire" },
      { text: "Calm", faction: "Earth" },
      { text: "Reflective", faction: "Water" },
      { text: "Detached", faction: "Wind" }
    ]
  },
  {
    question: "Pick a path:",
    options: [
      { text: "Burn through obstacles", faction: "Fire" },
      { text: "Stand unbroken", faction: "Earth" },
      { text: "Flow around pain", faction: "Water" },
      { text: "Break all patterns", faction: "Wind" }
    ]
  },
  {
    question: "Final instinct:",
    options: [
      { text: "Dominate", faction: "Fire" },
      { text: "Endure", faction: "Earth" },
      { text: "Understand", faction: "Water" },
      { text: "Escape", faction: "Wind" }
    ]
  }
];

/* ========================= SAFE DM ========================= */

async function safeDM(user, content) {
  try {
    return await user.send(content);
  } catch {
    return null;
  }
}

/* ========================= INTRO ========================= */

async function runIntro(user) {
  try {
    const msg = await safeDM(user, "░▒▓ SYSTEM INITIALIZING ▓▒░");
    if (!msg) return;

    const frames = [
      "⟟ SIGNAL DETECTED...",
      "⟊ SYSTEM CORRUPTION...",
      "⚠️ RECALIBRATING CORE...",
      "▒▓▒▒▓▒▒▓",
      "🜂 ELEMENTAL LINK ACTIVE",
      "🜁🜃🜄🜂 SYNCING...",
      "🕯️ FINALIZING INITIATION..."
    ];

    for (const frame of frames) {
      await wait(500);
      await msg.edit(frame).catch(() => {});
    }

    await wait(800);
    await msg.delete().catch(() => {});
  } catch {}
}

/* ========================= QUIZ FLOW ========================= */

async function startQuiz(interaction, user) {
  try {
    if (activeLocks.has(user.id)) {
      return interaction.reply({
        content: "⚠️ You already have an active session.",
        ephemeral: true
      });
    }

    activeLocks.add(user.id);

    await interaction.deferReply({ ephemeral: true });

    const dmTest = await safeDM(user, "⚡ Checking connection...");

    if (!dmTest) {
      activeLocks.delete(user.id);
      return interaction.editReply("❌ Open your DMs and try again.");
    }

    await interaction.editReply("⚡ Check your DMs to begin initiation.");

    await runIntro(user);

    sessions.set(user.id, {
      index: 0,
      score: { Fire: 0, Water: 0, Earth: 0, Wind: 0 },
      locked: false
    });

    sendQuestion(user);

  } catch (err) {
    activeLocks.delete(user.id);
    console.error("START ERROR:", err);
  }
}

/* ========================= QUESTIONS ========================= */

async function sendQuestion(user) {
  const session = sessions.get(user.id);
  if (!session || session.locked) return;

  session.locked = true;

  const q = quiz[session.index];
  if (!q) return finishQuiz(user);

  const embed = new EmbedBuilder()
    .setTitle(`Question ${session.index + 1}/${quiz.length}`)
    .setDescription(q.question);

  const row = new ActionRowBuilder();

  q.options.forEach((opt, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`q_${i}`)
        .setLabel(opt.text.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
  });

  let msg;
  try {
    msg = await user.send({ embeds: [embed], components: [row] });
  } catch {
    sessions.delete(user.id);
    activeLocks.delete(user.id);
    return;
  }

  const collector = msg.createMessageComponentCollector({
    time: 60000,
    max: 1
  });

  collector.on("collect", async (btn) => {
    if (btn.user.id !== user.id) return;

    await btn.deferUpdate();

    const session = sessions.get(user.id);
    if (!session) return;

    const index = Number(btn.customId.split("_")[1]);
    const selected = quiz[session.index].options[index];

    session.score[selected.faction]++;
    session.index++;

    const temp = await safeDM(user, "⏳ Processing...");
    if (temp) setTimeout(() => temp.delete().catch(() => {}), 300);

    await msg.delete().catch(() => {});

    session.locked = false;

    setTimeout(() => sendQuestion(user), 300);
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      sessions.delete(user.id);
      activeLocks.delete(user.id);
      await safeDM(user, "⏳ Timed out. Run /initiate again.");
    }
  });
}

/* ========================= FINISH ========================= */

async function finishQuiz(user) {
  const session = sessions.get(user.id);
  if (!session) return;

  const result = Object.entries(session.score)
    .sort((a, b) => b[1] - a[1])[0][0];

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);

    for (const id of Object.values(factionRoles)) {
      await member.roles.remove(id).catch(() => {});
    }

    await member.roles.add(factionRoles[result]).catch(() => {});

    if (member.roles.cache.has(REMOVE_ROLE_ID)) {
      await member.roles.remove(REMOVE_ROLE_ID).catch(() => {});
    }

    await member.roles.add(NEW_ROLE_ID).catch(() => {});

    await safeDM(user, "🏁 The ritual is complete...\n\nSomething has sealed your fate.");

  } catch (err) {
    console.log(err);
  }

  sessions.delete(user.id);
  activeLocks.delete(user.id);
}

/* ========================= EVENTS ========================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "initiate") return;

  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({
      content: "⚠️ This command can only be used in the designated channel.",
      ephemeral: true
    });
  }

  return startQuiz(interaction, interaction.user);
});

/* ========================= READY ========================= */

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

console.log("TOKEN:", process.env.BOT_TOKEN);

client.login(process.env.BOT_TOKEN);
