const config = require('../config');

const nodemailer = require('nodemailer');
// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    // TODO: use process.env
    user: 'xialvjun@gmail.com',
    // nodemailer-password: smyvqhbtscyvdppo
    pass: 'smyvqhbtscyvdppo'
  }
});

function captcha(code, options) {
  // return Promise.resolve(base64_image_str)
}

function email(code, options) {
  return new Promise((resolve, reject) => {
    transporter.sendMail({
      from: `xialvjun xialvjun@gmail.com`,
      to: options.to,
      subject: 'verification code',
      text: `Your verification code: ${code}`,
      html: `<p>Your verification code: ${code}<p>`
    }, (err, info) => {
      if (err) {
        return reject(err);
      }
      resolve(info);
    });
  });
}

function sms(code, options) {
  // return Promise.resolve()
}

async function verification(type, key, max_age, options) {
  let code = Math.random();
  let abc = await { captcha, email, sms }[type](code, options);
  await save(key, abc.code, max_age);
  return abc;
}

function verify(key, code) {
  return Promise.resolve(false)
}

module.exports = {
  verification, verify
}



