const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');

/**
 * Generates a random alphanumeric string of a given length.
 */
function generateRandomText(length = 5) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz'; // Exclude ambiguous characters
  let text = '';
  for (let i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * Generates a crisp, 100% compatible SVG captcha.
 * Fixed dimensions: 160px x 48px.
 * Baseline y=33px, text-anchor="middle" for perfect vertical & horizontal alignment.
 */
function generateSvgCaptcha(text) {
  const width = 160;
  const height = 48;
  
  // High-contrast hex colors (100% mobile & browser compatible)
  const hexColors = ['#c2410c', '#b45309', '#9a3412', '#ea580c', '#c2410c'];

  // Background noise lines
  let lines = '';
  lines += `<line x1="8" y1="14" x2="152" y2="34" stroke="#fed7aa" stroke-width="1.5" />`;
  lines += `<line x1="12" y1="36" x2="148" y2="12" stroke="#fed7aa" stroke-width="1.5" />`;

  // Background noise dots
  let dots = '';
  const dotCoords = [
    [15, 12], [35, 38], [55, 10], [75, 40], [95, 12], 
    [115, 36], [135, 14], [25, 25], [85, 22], [140, 28]
  ];
  dotCoords.forEach(([cx, cy]) => {
    dots += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="#fdba74" opacity="0.5" />`;
  });

  // 5 fixed start positions across 160px: 14, 44, 74, 104, 134
  // Absolute left-to-right horizontal alignment (NO text-anchor="middle" to avoid Android react-native-svg layout bugs)
  const xPositions = [14, 44, 74, 104, 134];
  let charsSvg = '';

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const x = xPositions[i] || (14 + i * 30);
    const color = hexColors[i % hexColors.length];

    charsSvg += `<text x="${x}" y="32" font-size="22" font-weight="bold" fill="${color}">${char}</text>`;
  }

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 10px;">
    ${lines}
    ${dots}
    ${charsSvg}
  </svg>`;
  return svg;
}

/**
 * Creates a captcha challenge: returns { captchaId, captchaSvg }
 */
function createCaptcha() {
  const text = generateRandomText(5);
  const captchaSvg = generateSvgCaptcha(text);
  
  // Encrypt the text into captchaId token (expires in 5 minutes)
  const captchaId = jwt.sign({ text: text }, JWT_SECRET, { expiresIn: '5m' });
  
  return { captchaId, captchaSvg };
}

/**
 * Verifies a captcha value against the captchaId
 */
function verifyCaptcha(captchaId, captchaValue) {
  if (!captchaId || !captchaValue) return false;
  try {
    const decoded = jwt.verify(captchaId, JWT_SECRET);
    return decoded.text.toLowerCase() === captchaValue.trim().toLowerCase();
  } catch (err) {
    return false; // Token expired or invalid signature
  }
}

module.exports = {
  createCaptcha,
  verifyCaptcha
};
