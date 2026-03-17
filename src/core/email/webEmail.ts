import * as nodemailer from 'nodemailer';
import * as hbs from 'nodemailer-express-handlebars';
import * as path from 'path';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebEmail {
  private transporter: nodemailer.Transporter;
  constructor() {
    const user = process.env.EMAIL;
    const pass = process.env.EMAIL_PASSWORD;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.zeptomail.com',
      port: 587,
      auth: {
        user,
        pass,
      },
    });
    const handlebarOptions: hbs.NodemailerExpressHandlebarsOptions = {
      viewEngine: {
        partialsDir: path.resolve('./src/core/email/templates/'),
        defaultLayout: false,
      },
      viewPath: path.resolve('./src/core/email/templates/'),
    };
    this.transporter.use('compile', hbs(handlebarOptions));
  }

  sendWelcomeEmail(name: string, email: string) {
    const title = 'Welcome to Cotrackr 🎉';
    const message =
      'Your account has been created successfully, Thank you for joining us at Cotrackr';
    this.sendNotificationEmail(name, email, title, message);
  }

  private sendNotificationEmail(
    name: string,
    email: string,
    title: string,
    body: string,
  ) {
    const mailOptions = {
      from: '"Cotrackr Team" <noreply@cotrackr.co>', // sender address
      to: email, // list of receivers
      subject: title,
      template: 'notification_email', // the name of the template file i.e email.handlebars
      context: {
        name: name,
        body,
      },
    };

    // trigger the sending of the E-mail
    this.transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        return console.log(error);
      }
      console.log('Email sent');
    });
  }
}
