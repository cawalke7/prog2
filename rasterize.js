/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var colorBuffer;
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // where to put color for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

function getColor(coord, index) {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
		// color: Ka*La + Kd*Ld*(N(\dot)L) + Ks*Ls*(N(\dot)H)^n
		// looking at, L_'s are all 1.
		var lightCoord = [-1, 3, -0.5];
		
		var ambColor = inputTriangles[index].material.ambient; 
		var difColor = inputTriangles[index].material.diffuse;
		var spcColor = inputTriangles[index].material.specular;
		var n = inputTriangles[index].material.n;
		
		// Ambient
		//console.log(ambColor);
		var ambR = ambColor[0];
		var ambG = ambColor[1];
		var ambB = ambColor[2];
		
		// Diffuse
		// "up" vector
		var N = [0,1,0]; // as stated in prog2 instructions
		
		// Normalize light source
		var lightMag = Math.sqrt(Math.pow(lightCoord[0],2) 
				+ Math.pow(lightCoord[1],2) 
				+ Math.pow(lightCoord[2],2));
		var L = [lightCoord[0]/lightMag, lightCoord[1]/lightMag, lightCoord[2]/lightMag];;
		
		var NdotL = N[0]*L[0] + N[1]*L[1] + N[2]*L[2];
		
		var difR = difColor[0] * NdotL;
		var difG = difColor[1] * NdotL;
		var difB = difColor[2] * NdotL;
		
		//console.log([difR,difG,difB]);
		
		// TODO Specular
		// Find NdotH
		// Find H 
		// Find V+L, and normalize(?)
		var V = [0.5, 0.5, -0.5]; // as stated in prog2 instructions
		var eyeMag = Math.sqrt(Math.pow(V[0],2) 
				+ Math.pow(V[1],2) 
				+ Math.pow(V[2],2));
		var VL_mag = Math.sqrt(Math.pow(V[0]/eyeMag+L[0],2)
				+ Math.pow(V[1]/eyeMag+L[1],2)
                + Math.pow(V[2]/eyeMag+L[2],2));

		//var H = [(V[0]/eyeMag+L[0]) / VL_mag, (V[1]/eyeMag+L[1]) / VL_mag, (V[2]/eyeMag+L[2]) / VL_mag];
		var H = [(V[0]/eyeMag+L[0]) / VL_mag, (V[1]/eyeMag+L[1]) / VL_mag, (V[2]/eyeMag+L[2]) / VL_mag];
		
		var NdHpn = Math.pow(N[0]*H[0] + N[1]*H[1] + N[2]*H[2], inputTriangles[index].material.n);

		var spcR = spcColor[0] * NdHpn;
		var spcG = spcColor[1] * NdHpn;
		var spcB = spcColor[2] * NdHpn;
		//console.log([spcR,spcG,spcB]);

		var r = ambR + difR + spcR;
		var g = ambG + difG + spcG;
		var b = ambB + difB + spcB;
				
		//return [1.0, 1.0, 1.0, 1.0];
		return [r, g, b, 1.0];
    }
}

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        // TODO replace colors with this
        var colorArray = [];
        
        // This is for the each set of triangles
        // Note this is not every triangle
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
          
            //console.log(inputTriangles[whichSet].triangles);
            //console.log(inputTriangles[whichSet].vertices);
            //console.log(inputTriangles[whichSet].material);
            
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                var thisTriangleArray = inputTriangles[whichSet].triangles[whichSetTri];
                //console.log(thisTriangleArray);
                
                // NOW set up the vertex coord array
                for (whichSetVert=0; whichSetVert<thisTriangleArray.length; whichSetVert++){
                    // Ha! This is my index!
                    index = thisTriangleArray[whichSetVert];
                    //console.log(index);
                    
                    var thisVertex = inputTriangles[whichSet].vertices[index];
                    
                    coordArray = coordArray.concat(thisVertex);
                    //console.log(thisVertex);
                    
                    // find 4D color for colorArray using thisVertex
                    var thisColor = getColor(thisVertex, whichSet);
                    colorArray = colorArray.concat(thisColor);
                }
            }
        } // end for each triangle set 
        triBufferSize = coordArray.length / 3;
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorArray), gl.STATIC_DRAW);
        
        //console.log(coordArray);
        //console.log(colors);
        
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
    	varying lowp vec4 vColor;
        void main(void) {
            //gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // all fragments are white
            gl_FragColor = vColor;
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec4 vertexColor;
        
        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position
            vColor = vertexColor;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                gl.enableVertexAttribArray(vertexColorAttrib);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // TODO activate
    gl.vertexAttribPointer(vertexColorAttrib,4,gl.FLOAT,false,0,0); // feed

    gl.drawArrays(gl.TRIANGLES,0,triBufferSize); // render
    //console.log(triBufferSize);
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main
