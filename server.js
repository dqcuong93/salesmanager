var express = require('express');
var app = express();
var db = require('./db');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer({dest: 'uploads/'});

app.set('views', './views');
app.set('view engine', 'pug');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(upload.array());

app.get('/', function (req, res) {
    res.render('home');
});

app.post('/submit', function (req, res) {
    // console.log(req.body);
    db.createKhachHang(req.body);
    db.createDonHang(req.body);
    res.redirect('/');
});

var server = app.listen(8080, function () {
    console.log('Server has started on port ' + server.address().port);
    db.authenticateConnection();
    db.sync();
});