var nodemailer = require("nodemailer");

var config = null;
var smtpTransport = null;

/*
      host : "localhost",              // smtp server hostname
      port : "25",                     // smtp server port
      ssl: true,                        // for SSL support - REQUIRES NODE v0.3.x OR HIGHER
      domain : "localhost",            // domain used by client to identify itself to server
      to : "marak.squires@gmail.com",
      from : "obama@whitehouse.gov",
      subject : "node_mailer test email",
      body: "Hello! This is a test of the node_mailer.",
      authentication : "login",        // auth login is supported; anything else is no auth
      username : "my_username",        // username
      password : "my_password"         // password
*/
exports.create = function (_config){
	config = _config;

	smtpTransport = nodemailer.createTransport("SMTP", {
		host: config.host, // hostname
		secureConnection: config.ssl, // use SSL
		name: config.domain,
		port: config.port, // port for secure SMTP
		auth: {
			user: config.username,
			pass: config.password
		}
	});

	return(this);
}

//Sync send email
exports.send = function (_to, _subject, _body, callback) {

	//var email = merge({'to':_to,'subject':_subject,'html':_body},config);
	var mailOptions = {'from':config.from,'to':_to,'subject':_subject,'html':_body};
	
	smtpTransport.sendMail(mailOptions,function(err,response) {
		
		if(err) console.error('MOAPPI.SMTP Unable to send email',_to,err.message);

		if(callback) callback(err,response);
	});
}