const http = require("http");
const fs = require("fs");
http.get("https://localhost:3001/credenciales/cedula=20424886", res => {
  let s = "";
  res.on("data", c => s += c);
  res.on("end", () => {
    fs.writeFileSync("tmp_cred_full.html", s);
    let m = s.match(/<img[^>]*src=["'']([^"'']+)["''][^>]*>/i);
    console.log("STATUS", res.statusCode);
    console.log(m ? m[1] : "NO_IMG");
  });
}).on("error", e => console.error(e));
