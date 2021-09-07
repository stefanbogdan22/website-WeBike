const express = require("express");
var app = express();

const session = require('express-session');
const formidable = require('formidable');
const crypto = require('crypto');
const nodemailer =require('nodemailer'); 
var mysql = require('mysql');
var fs = require("fs")
const { getMaxListeners } = require("process");


/*app.use(session({
    secret: "abcdefg",
    resave: true,
    saveUnitialized: false
}));*/

app.use(session({
    secret: 'abcdefg', //folosit de express session pentru criptarea id-ului de sessiune
    resave: true,
    saveUninitialized: false
}));

app.set('view engine' , 'ejs');

app.use(express.static(__dirname+'/resurse'));
app.use(express.static(__dirname+'/poze_uploadate'))

var conexiuneDB = mysql.createConnection({
    host:"localhost",
    user:"bogdan",
    password:"bogdanstefan",
    database:"biciclete"
});

conexiuneDB.connect(function(err){
    if(err){
        console.log("Conexiune esuata")
    }
    else{
        console.log("Conexiune mysql cu succes")
    }
});

app.get('/', function(req, res) {
	if (req.session){
		console.log(req.session.utilizator);

		res.render('pagini/index', {utilizator:req.session.utilizator});
	}
	else{
		res.render('pagini/index');
	}
});

function getUtiliz(req){
	var utiliz;
	if(req.session){
		utiliz=req.session.utilizator
	}
	else{utiliz=null}
	return utiliz;
}

app.get('/inreg', function(req, res){
    res.render('pagini/inregistrare_user')
})

async function trimiteMail(nume, username, email){
    var transp = nodemailer.createTransport({
        service: "gmail",
        secure: false,
        auth:{
            user: "proiecttwbiciclete@gmail.com",
            pass: "1q2w3e4r@"
        },
        tls:{
            rejectUnauthorized: false
        }
    });
    await transp.sendMail({
        from:"proiecttwbiciclete@gmail.com",
        to: email,
        subject: "Salut, stimate " + nume +".",
        text: "Username-ul tau este " + unescapedUsername +" pe site-ul www.webike.ro",
        html:"<p>Username-ul tau este "+unescapedUsername+" pe site-ul <b><i><u>www.webike.ro</u></i></b></p>",
    })
    console.log("Email trimis!")

}

var parolaServer = "tehniciweb";
app.post("/inreg", function(req, res){
    var username;
    var formular = formidable.IncomingForm()
    console.log("Am intrat pe post");
    
    //nr ordine: 4
    formular.parse(req, function(eroare, campuriText, campuriFisier){
        var eroare="";
        var pathImagine="";
        console.log(campuriText);
        
        if(campuriText.nume==""){
            eroare += "Camp nume gol "
        }
        if(campuriText.prenume==""){
            eroare += "Camp prenume gol "
        }
        if(campuriText.username==""){
            eroare += "Camp username gol "
        }
        if(campuriText.parola==""){
            eroare += "Camp parola goala "
        }
        if(campuriText.rparola==""){
            eroare += "Camp repetare parola gol "
        }
        if(campuriText.email==""){
            eroare += "Camp email gol "
        }
        if(campuriText.parola!=campuriText.rparola){
            eroare += "Parola si Reperate parola trebuie sa coincida "
        }
        //if(!(/\+0[0-9]{9,}$/.test(campuriText.telefon) || /0[0-9]{9,}$/.test(campuriText.telefon)) && campuriText.telefon!=""){
        if((campuriText.telefon).match(new RegExp("\\+0[0-9]{9,}$"))==false || (campuriText.telefon).match(new RegExp("0[0-9]{9,}$"))==false && campuriText.telefon!=""){
            eroare += "Formatul telefonului nu este corect "
        }
        console.log(eroare)
        if(eroare==''){
            
            unescapedUsername = campuriText.username
            unescapedEmail = campuriText.email
            unescapedNume = campuriText.nume
            campuriText.username = mysql.escape(campuriText.username)
            campuriText.nume = mysql.escape(campuriText.nume)
            campuriText.prenume = mysql.escape(campuriText.prenume)
            campuriText.parola = mysql.escape(campuriText.parola)
            campuriText.email = mysql.escape(campuriText.email)
            campuriText.telefon = mysql.escape(campuriText.telefon)
            pathImagine = mysql.escape(pathImagine)
            console.log(pathImagine)
            var parolaCriptata=mysql.escape(crypto.scryptSync(campuriText.parola, parolaServer, 32).toString("ascii"));

            var comandasql = `select id from utilizatori where username=${campuriText.username};`
            conexiuneDB.query(comandasql, function(err, rez, campuri){
                if(err) {
                    throw err;
                }
                if(rez.length!=0){
                    eroare += 'Username deja luat'
                    res.render("pagini/inregistrare_user",{eror: eroare, raspuns: "Completati corect campurile"})
                }
                else{
                    
                    var comanda=`insert into utilizatori (nume, prenume, username, parola, email, telefon, imagine) values (${campuriText.nume}, ${campuriText.prenume}, ${campuriText.username}, ${parolaCriptata}, ${campuriText.email}, ${campuriText.telefon}, ${pathImagine})`;
                    console.log(comanda);
                    conexiuneDB.query(comanda, function(err, rez, campuri){
                        if(err) {
                            console.log(err);
                            throw err;
                        }
                        trimiteMail(unescapedNume, unescapedUsername, unescapedEmail)
                        res.render("pagini/inregistrare_user",{eror:"", raspuns: "Cont creat cu succes!"})
                    })
                }
            })
        }
        else{
            res.render("pagini/inregistrare_user",{eror: eroare, raspuns: "Completati corect campurile"})
        }
    })
    //nr ordine: 1
    formular.on("field", function(name, field){
        if(name=='username')
            username=field;
        console.log("camp-field", name)
    });
    //nr ordine: 2
    formular.on("fileBegin", function(name, campFisier){
            console.log("inceput upload: ", campFisier);
            if(campFisier && campFisier.name!=""){
            //am fisier transmis
            var cale = __dirname+"/poze_uploadate/"+username
            console.log(campFisier.cale)
            if(!fs.existsSync(cale))
                fs.mkdirSync(cale)
            campFisier.path=cale+"/"+campFisier.name;
            console.log(campFisier.path)
            pathImagine=(campFisier.path).toString('ascii')
            pathImagine=mysql.escape(pathImagine)
            console.log(pathImagine)
        }
    })
    //nr ordine: 3
    formular.on("file", function(name, field){
        console.log("final upload", name);
    })
});
////// logare si delogare
app.post("/login",function(req, res){
	var formular= formidable.IncomingForm()
	console.log("am intrat pe login");
	
	formular.parse(req, function(err, campuriText, campuriFisier){//se executa dupa ce a fost primit formularul si parsat
		var parolaCriptata=mysql.escape(crypto.scryptSync(campuriText.parola,parolaServer,32).toString("ascii"));
		campuriText.username=mysql.escape(campuriText.username)
		var comanda=`select rol, email, nume from utilizatori where username=${campuriText.username}` //and parola=${parolaCriptata};`;
		conexiuneDB.query(comanda, function(err, rez, campuri){
			console.log(comanda);
			if(rez && rez.length==1){
                console.log("logat")
				req.session.utilizator={
					rol:rez[0].rol,
					username:campuriText.username,
					nume:rez[0].nume,
					email:rez[0].email
				}
				res.render("pagini/index",{utilizator:req.session.utilizator});
			}
			else{
                console.log("nelogat")
				res.render("pagini/login");
			}
		});
	});
});

app.get('/login', function(req, res){
    res.render('pagini/login')
})


app.get('/logout', function(req, res){
	console.log("logout");
	req.session.destroy();
	res.render("pagini/index");
});

/*app.post("/login", function(req, res){
    var formular=formidable.IncomingForm()
    console.log("am intrat pe login")

    formular.parse(req, function(eroare, campuriText, campuriFisier){
        var eroare="";
        console.log(campuriText)
        var parolaCriptata=crypto.scryptSync(campuriText.parola, parolaServer, 32);
        var comanda=`select username, email from utilizatori where username='${campuriText.username}' and parola='${parolaCriptata}'`
        conexiuneDB.query(comanda, function(err, rez, campuri){
            if(err) {
                console.log(err);
                throw err;
            }
            if(rez.length==1){
                user={
                    username: rez[0].username,
                    email: rez[0].email
                }
            
            console.log(user);
            //creez un camp in sesiune
            req.session.user=user;
            res.render("pagini/index", {utilizator: user});
            }
            else{
                res.render("html/index");
            }

        })
    })
})
*/

////galerie statica si animata
app.get('/galeriestatica', function(req, res){

    res.render('pagini/galerie-statica');
})

app.get('/galerieanimata', function(req, res){

    res.render('pagini/galerie-animata');
})

///pagina produse
app.get('/biciclete', function(req, res){

    conexiuneDB.query("select * from bikes;", function(err, rezultat, campuri){
        if(err) throw err;
        console.log(rezultat)
        res.render('pagini/biciclete',{bikes: rezultat});
    })
})
//// 404
app.get('/*', function(req, res){
    var utiliz;
    if(req.session){
        utiliz=req.session.utilizator
    }
    else{utiliz=null}
  
    res.render('html' + req.url,{utilizator:utiliz}, function(err, rezRandare){
          if(err){
                  if(err.message.indexOf("Failed to lookup view")!=-1){
                      res.status(404).render("pagini/404", {utilizator:utiliz})
          
                  }
          else throw err
          }
      else res.send(rezRandare)
      });
  });



app.listen(8080);
console.log('Serverul a pornit pe portul 8080');