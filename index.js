const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const dns = require("dns");
dns.setServers(["8.8.8.8"]);

const nodemailer = require('nodemailer');

const app = express();
const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

mongoose.connect(mongoUri).then(() => {
    console.log("Connected to MongoDB");
})
    .catch((err) => {
        console.log("Error connecting to MongoDB", err);
    });

const credential = mongoose.model("passkey", {}, "bulkmail")

// Create a transporter

app.post("/sendmail", (req, res) => {
    console.log("POST /sendmail received");
    const msg = req.body.msg;
    const email = Array.isArray(req.body.email) ? req.body.email : [];
    const recipients = typeof req.body.recipients === "string"
        ? req.body.recipients.split(/[\s,;]+/)
        : [];
    const emailList = [...email, ...recipients]
        .map((address) => address.trim())
        .filter(Boolean);
    const subject = req.body.subject;

    console.log("Recipients to send:", emailList);
    

    credential.findOne().then((data) => {
        if (!data) {
            console.error("No email credentials found in MongoDB");
            return res.status(500).send(false);
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: data.toJSON().user,
                pass: data.toJSON().password, // NOT your regular password
            },
        });
        new Promise(async (resolve, reject) => {
            try {
                for (let i = 0; i < emailList.length; i++) {
                    const result = await transporter.sendMail(
                        {
                            from: data.toJSON().user,
                            to: emailList[i],
                            subject: subject,
                            text: msg,
                        },

                    )
                    console.log("Email sent successfully to " + emailList[i], result.accepted);
                }
                resolve("success")
            }
            catch (error) {
                reject("failed")
            }
        }).then(() => {
            res.send(true)
        })
            .catch((error) => {
                console.error("Email sending failed:", error);
                res.send(false)
            })

        console.log(data.toJSON())
    }).catch((err) => {
        console.error("Database lookup failed:", err);
        res.status(500).send(false);
    });


})


if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

module.exports = app;