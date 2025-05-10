const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const ratelimiter = require('express-rate-limit');
const axios = require('axios');
const env = require('dotenv').config();
const app = express();

const allowedOrigins = ['http://localhost', 'https://cuzimstupi4.eu'];
const allowedIP = process.env.ip || "127.0.0.1"

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ip === allowedIP) return next();
  ratelimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: 'rate limited'
  })(req, res, next);
});

app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('not allowed'));
    }
  }
}));

function isValidDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function DoMath(month, day, year) {
  const birthYear = 2000 + parseInt(year, 10);
  const birthMonth = parseInt(month, 10);
  const birthDay = parseInt(day, 10);

  if (!isValidDate(birthYear, birthMonth, birthDay)) {
    throw new Error('Invalid date');
  }

  const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  if (today < thisYearBirthday) age--;

  let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (today >= nextBirthday) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);

  const diffMs = nextBirthday - today;
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));

  return {
    age,
    nextBirthday: `in ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`
  };
}

app.get('/:month/:day/:year', (req, res) => {
  const startTime = Date.now();
  const { month, day, year } = req.params;

  if (!/^\d{2}$/.test(month) || !/^\d{2}$/.test(day) || !/^\d{2}$/.test(year)) {
    return res.status(400).json({ error: 'invalid format Use MM/DD/YY' });
  }

  try {
    const result = DoMath(month, day, year);
    // res.json(result);
    res.json({
      age: result.age,
      nextBirthday: result.nextBirthday,
      timetook: Date.now() - startTime + 'ms'
    });
  } catch {
    res.status(400).json({ error: 'invalid date' });
  }
});


const getUserData = async (userId) => {
  try {
    const response = await axios.get(`https://api.lanyard.rest/v1/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error while getting user data:', error);
    return null;
  }
};

app.get('/discord/:userId', async (req, res) => {
  const startTime = Date.now();
  const userId = req.params.userId;
  // const userId = process.env.userId;
  const userData = await getUserData(userId);

  if (!userData || !userData.data) {
    return res.status(404).json({ error: 'probably ratelimited' });
  }

  const filteredData = {
    status: userData.data.discord_status,
    activities: userData.data.activities.map((activity) => {
      return {
        // id: activity.id,
        name: activity.name,
        // type: activity.type,
        state: activity.state,
        // emoji: activity.emoji,
        // created_at: activity.created_at,
      };
    }),
    spotify: Array.isArray(userData.data.spotify)
      ? userData.data.spotify.map((spotify) => ({
        album: spotify.album,
        artist: spotify.artist,
        song: spotify.song,
        image: spotify.album_art_url,
      }))
      : userData.data.spotify
        ? [{
          album: userData.data.spotify.album,
          artist: userData.data.spotify.artist,
          song: userData.data.spotify.song,
          image: userData.data.spotify.album_art_url,
        }]
        : [],
    avatar: `https://cdn.discordapp.com/avatars/${userData.data.discord_user.id}/${userData.data.discord_user.avatar}.png?size=1024`,
    username: userData.data.discord_user.username,
    displayName: userData.data.discord_user.display_name,
    timetook: Date.now() - startTime + 'ms',
  };

  res.json(filteredData);
});

app.get('/', (req, res) => {
  // res.send('OK');

  res.json({
    message: 'OK',
    routes: {
      '/discord': 'discord data',
      '/:month/:day/:year': 'get age & next birthday'
    }
  });

})


app.listen(process.env.port, () => {
  console.log('running: http://localhost:' + process.env.port);
});
