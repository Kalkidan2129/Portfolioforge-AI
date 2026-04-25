require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { sql, connectDB } = require('./config/db');
const app = express();

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(express.json());
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
const PORT = process.env.PORT || 3000;
const items = [];

let portfolioViews = 0;
let portfolioSaves = 0;

// Helper function to generate professional project descriptions
const generateProjectDescription = (project) => {
  const { title, tech } = project;
  const language = (tech || '').toLowerCase();
  
  if (language === 'python') {
    return `${title} is a Python-based project focused on data processing, backend development, and automation scripting. It demonstrates practical skills in building efficient data-driven solutions.`;
  }
  
  if (language === 'javascript' || language === 'typescript') {
    return `${title} is a JavaScript project focused on web development, frontend, or full-stack implementation. It showcases skills in building interactive and responsive web applications.`;
  }
  
  if (language === 'java') {
    return `${title} is a Java-based application demonstrating object-oriented programming and enterprise software development.`;
  }
  
  if (language === 'go' || language === 'golang') {
    return `${title} is a Go project highlighting modern backend development and high-performance systems.`;
  }
  
  if (language === 'rust') {
    return `${title} is a Rust project demonstrating systems programming and memory-safe implementation.`;
  }
  
  if (language === 'c#' || language === 'csharp') {
    return `${title} is a C# project focused on .NET development and enterprise applications.`;
  }
  
  if (language === 'ruby') {
    return `${title} is a Ruby project showcasing web development using the Rails framework.`;
  }
  
  if (language === 'php') {
    return `${title} is a PHP project focused on backend web development and server-side scripting.`;
  }
  
  if (language === 'swift') {
    return `${title} is a Swift project for iOS/macOS application development.`;
  }
  
  if (language === 'kotlin') {
    return `${title} is a Kotlin project focused on Android development or JVM-based applications.`;
  }
  
  // Default/general description for unknown languages
  return `${title} is a software project demonstrating technical implementation and problem-solving skills. It shows practical experience in building functional applications.`;
};

app.get('/', (req, res) => {
  res.send(`
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f8f9fb;
        margin: 0;
        padding: 60px;
        color: #222;
        text-align: center;
      }

      .home-container {
        background: white;
        max-width: 700px;
        margin: 0 auto;
        padding: 50px;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      }

      h1 {
        color: #1f3c88;
        font-size: 36px;
        margin-bottom: 15px;
      }

      p {
        font-size: 18px;
        line-height: 1.6;
        margin-bottom: 30px;
      }

      a {
        display: inline-block;
        background-color: #1f6feb;
        color: white;
        padding: 12px 22px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
      }

      a:hover {
        background-color: #174ea6;
      }
    </style>

    <div class="home-container">
      <h1>PortfolioForge AI</h1>
      <p>Turn your GitHub projects into a clean, professional portfolio with recommendations and analytics.</p>
      <a href="/auth/github">Login with GitHub</a>
    </div>
  `);
});

app.get('/dashboard', (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }

  const username = req.user.profile.username;

  res.send(`
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f8f9fb;
        margin: 0;
        padding: 50px;
        color: #222;
      }

      .dashboard {
        background: white;
        max-width: 900px;
        margin: 0 auto;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      }

      h1 {
        color: #1f3c88;
      }

      .actions {
        margin-top: 30px;
        display: grid;
        gap: 15px;
      }

      a {
        display: block;
        background-color: #1f6feb;
        color: white;
        padding: 14px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: bold;
        text-align: center;
      }

      a:hover {
        background-color: #174ea6;
      }
    </style>

    <div class="dashboard">
      <h1>Welcome, ${username}</h1>
      <p>Manage your GitHub-powered portfolio from one place.</p>

      <div class="actions">
        <a href="/api/portfolio/save-from-github">Save / Refresh GitHub Portfolio</a>
        <a href="/portfolio/view">View Portfolio</a>
        <a href="/api/analytics">View Analytics JSON</a>
      </div>
    </div>
  `);
});

app.get('/api/test', (req, res) => {
  res.json(items);
});

app.post('/api/test', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0 || !req.body.name || req.body.name.trim() === '') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const newItem = {
    name: req.body.name,
    createdAt: new Date()
  };
  items.push(newItem);
  res.json(items);
});

app.get('/api/repos', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description && repo.description.trim() !== ''
  ? repo.description
  : generateProjectDescription({
      title: repo.name,
      tech: repo.language
    }),
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  res.json(portfolioRepos);
});



app.get('/api/portfolio', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = String(req.user.profile.id);

  try {
    const result = await sql.query`
      SELECT PortfolioJson
      FROM UserPortfolios
      WHERE GitHubUserId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.json({ message: 'No portfolio found' });
    }

    const portfolio = JSON.parse(result.recordset[0].PortfolioJson);
    res.json(portfolio);
  } catch (err) {
    console.error('❌ Error fetching portfolio from DB:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio from database' });
  }
});

app.get('/api/portfolio/generate', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.json({ message: 'No portfolio found' });
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error generating portfolio from DB:', err);
  return res.status(500).json({ error: 'Failed to generate portfolio from database' });
}
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const portfolioSummary = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  res.json({
    owner: username,
    portfolioTitle: `${username}'s Portfolio`,
    projectCount: portfolio.length,
    projects: portfolio,
    techSummary,
    portfolioSummary
  });
});

app.get('/api/portfolio/generate-narrative', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.json({ message: 'No portfolio found' });
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error generating narrative from DB:', err);
  return res.status(500).json({ error: 'Failed to generate narrative from database' });
}
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const narrativePrompt = `Write a professional portfolio summary for ${username} who has built ${portfolio.length} projects using ${techSummary.join(', ')}.`;
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  res.json({
    owner: username,
    projectCount: portfolio.length,
    techSummary,
    narrativePrompt,
    generatedNarrative
  });
});

app.get('/api/portfolio/save-from-github', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description && repo.description.trim() !== ''
  ? repo.description
  : generateProjectDescription({
      title: repo.name,
      tech: repo.language
    }),
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  const userId = req.user.profile.id;

const username = req.user.profile.username;

await sql.query`
  MERGE UserPortfolios AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioJson = ${JSON.stringify(portfolioRepos)},
      GitHubUsername = ${username},
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, GitHubUsername, PortfolioJson, UpdatedAt)
    VALUES (${String(userId)}, ${username}, ${JSON.stringify(portfolioRepos)}, GETDATE());
`;

await sql.query`
  MERGE PortfolioAnalytics AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioSaves = PortfolioSaves + 1,
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioViews, PortfolioSaves, UpdatedAt)
    VALUES (${String(userId)}, 0, 1, GETDATE());
`;
res.json({ message: 'Portfolio saved to database', count: portfolioRepos.length });
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  async (req, res) => {
    const accessToken = req.user.accessToken;

const response = await fetch('https://api.github.com/user/repos', {
  headers: {
    Authorization: `token ${accessToken}`
  }
});

const data = await response.json();

const portfolioRepos = data.map(repo => ({
  title: repo.name,
  summary: repo.description || 'No description available',
  link: repo.html_url,
  tech: repo.language || 'Not specified',
  lastUpdated: repo.updated_at
}));

const userId = req.user.profile.id;

// Save to database
await sql.query`
  MERGE UserPortfolios AS target
  USING (SELECT ${userId} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET PortfolioJson = ${JSON.stringify(portfolioRepos)}, UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioJson)
    VALUES (${userId}, ${JSON.stringify(portfolioRepos)});
`;

// Optional: update saves count
await sql.query`
  MERGE PortfolioAnalytics AS target
  USING (SELECT ${userId} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET PortfolioSaves = PortfolioSaves + 1, UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioSaves)
    VALUES (${userId}, 1);
`;

res.redirect('/dashboard');
  }
);

app.get('/portfolio/view', async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.send('No portfolio found');
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error loading portfolio from DB:', err);
  return res.status(500).send('Failed to load portfolio from database');
}
  await sql.query`
  MERGE PortfolioAnalytics AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioViews = PortfolioViews + 1,
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioViews, PortfolioSaves, UpdatedAt)
    VALUES (${String(userId)}, 1, 0, GETDATE());
`;
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  
const recommendations = [];

if (portfolio.length === 0) {
  recommendations.push('Start by saving your GitHub repositories to build your portfolio.');
} else {
  

  const projectsWithNoDescription = portfolio.filter(
    p => 
      !p.summary || 
      p.summary === 'No description' || 
      p.summary === 'No description available' ||
      p.summary.trim() === ''
  ).length;

  if (projectsWithNoDescription > 0) {
    recommendations.push(
      `${projectsWithNoDescription} project(s) have missing descriptions. Add clear descriptions to explain your work.`
    );
  }
  if (techSummary.length < 3) {
    recommendations.push('Expand your tech stack by learning new technologies to show versatility.');
  }

  if (techSummary.includes('JavaScript')) {
    recommendations.push('Consider building a full-stack project to showcase end-to-end development skills.');
  }

  if (portfolio.length < 3) {
    recommendations.push('Consider adding more projects to showcase your skills. Aim for at least 3-5 projects.');
  } else if (portfolio.length < 5) {
    recommendations.push('Good progress! Continue building projects to strengthen your portfolio.');
  } else if (portfolio.length >= 5) {
    recommendations.push('Great portfolio size! Consider highlighting your top 2–3 projects to make your profile more focused.');
  }

  
}
  const projectsList = portfolio.map(project => 
    `<li><strong>${project.title}</strong> - ${project.summary} (${project.tech === 'Not specified' ? 'N/A' : project.tech}) <a href="${project.link}">View</a></li>`
  ).join('');
  const analyticsResult = await sql.query`
  SELECT PortfolioViews, PortfolioSaves
  FROM PortfolioAnalytics
  WHERE GitHubUserId = ${userId}
`;

const analytics = analyticsResult.recordset[0] || {
  PortfolioViews: 0,
  PortfolioSaves: 0
};
  res.send(`
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 40px 0;
      background-color: #f8f9fb;
      color: #222;
      line-height: 1.6;
      
    }
    .container {
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      max-width: 1000px;
      width: 90%;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }  
    h1 {
      color: #1f3c88;
      margin-bottom: 20px;
    }
    h2 {
      color: #2c3e50;
      margin-top: 35px;
      margin-bottom: 10px;
      border-bottom: 2px solid #dfe6ee;
      padding-bottom: 5px;
    }
    p {
      margin: 10px 0;
      max-width: 1000px;
    }
    ul {
      padding-left: 25px;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: #1f6feb;
      text-decoration: none;
      font-weight: bold;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
<div class="container">
  <h1>${username}'s Portfolio</h1>
  <p>${generatedNarrative}</p>
  <p><strong>Total Projects:</strong> ${portfolio.length}</p>
  <p><strong>Technologies:</strong> ${techSummary.join(', ')}</p>

  <h2>Projects</h2>
  <ul>${projectsList}</ul>

  <h2>Recommendations</h2>
  <ul>
    ${recommendations.map(r => `<li>${r}</li>`).join('')}
  </ul>
  <h2>Analytics</h2>
  <p>Portfolio Views: ${analytics.PortfolioViews}</p>
  <p>Portfolio Saves: ${analytics.PortfolioSaves}</p>
</div>
`);
});

app.get('/portfolio/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const result = await sql.query`
      SELECT PortfolioJson, GitHubUsername 
      FROM UserPortfolios
      WHERE GitHubUsername = ${username}
    `;

    if (result.recordset.length === 0) {
      return res.send('Portfolio not found');
    }

    const portfolio = JSON.parse(result.recordset[0].PortfolioJson);

    const projectsList = portfolio.map(project => `
  <li style="margin-bottom: 15px;">
    <strong style="font-size: 16px;">${project.title}</strong><br/>
    <span style="color: #555;">${project.summary}</span><br/>
    <a href="${project.link}" target="_blank" 
       style="color: #1f6feb; font-weight: bold; text-decoration: none;">
       🔗 View Project
    </a>
  </li>
`).join('');

    res.send(`
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f8f9fb;
      margin: 0;
      padding: 40px;
      color: #222;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    h1 {
      color: #1f3c88;
    }
    h2 {
      margin-top: 30px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
  </style>

  <div class="container">
    <h1>${username}'s Portfolio</h1>
    <p>This portfolio highlights projects and development work from GitHub.</p>

    <h2>Projects</h2>
    <ul>${projectsList}</ul>
  </div>
`);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading portfolio');
  }
});

app.get('/api/analytics', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = String(req.user.profile.id);

  try {
    const result = await sql.query`
      SELECT PortfolioViews, PortfolioSaves
      FROM PortfolioAnalytics
      WHERE GitHubUserId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.json({
        portfolioViews: 0,
        portfolioSaves: 0
      });
    }

    const analytics = result.recordset[0];

    res.json({
      portfolioViews: analytics.PortfolioViews,
      portfolioSaves: analytics.PortfolioSaves
    });
  } catch (err) {
    console.error('❌ Error fetching analytics from DB:', err);
    res.status(500).json({ error: 'Failed to fetch analytics from database' });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
