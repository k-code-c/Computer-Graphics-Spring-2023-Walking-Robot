</script><head><meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">
<title>TUC Graphics - WebGL Sandbox</title>

<!-- external libraries for matrix calculations and maintenance -->
<script type="text/javascript" src="./sandbox_files/glMatrix-0.9.5.min.js"></script>
<script type="text/javascript" src="./sandbox_files/webgl-utils.js"></script>

<!-- Code for the vertex shader-->
<script id="shader-vs" type="x-shader/x-vertex">
//attributes for the vertex shader (different for every thread/core that will execute a copy of this)
    attribute vec3 aVertexPosition;
    attribute vec4 aVertexColor;

	//ModelView and Projection Matrices
    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;

	//Variable to be forwarded to the corresponding thread of the fragment shader
    varying vec4 vColor;

	//main function of the vertex shader
	//this code will be copied to many shader cores/threads and executed with the associated
	//data for every vertex (matrices, color, etc)
    void main(void) {
	
	//Each vertex is multiplied with the ModelView and Projection matrices and created a fragment
	    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
		//Its color is forwarded to the fragment shader
        vColor = aVertexColor;
    }
</script>

<!-- Code for the fragment shader-->
<script id="shader-fs" type="x-shader/x-fragment">
    //necessary code for compatibility
	precision mediump float;

	//Variable coming from the vertex shader
    varying vec4 vColor;

    void main(void) {
	//the fragment gets its color value.
	//in the fragment shader many advanced shading algorithms can be implemented (Phong etc..)
        gl_FragColor = vColor;
    }
</script>

<!-- Javascript code for the main functionality of the WebGL application-->
<script type="text/javascript">

    //the variable that will accommodate the WebGL context
	//every call to the state machine will be done through this variable
    var gl;

	//Initialize WebGL
    function initGL(canvas) {
        try {
		//get a webgl context
            gl = canvas.getContext("experimental-webgl");
			//assign a viewport width and height based on the HTML canvas element properties
			//(check last lines of code)
            gl.viewportWidth = canvas.width;
            gl.viewportHeight = canvas.height;
			//any error is handled here
			//all errors are visible in the console (F12 in Google chrome)
        } catch (e) {
        }
        if (!gl) {
            alert("Could not initialise WebGL, sorry :-(");
        }
    }


	//Find and compile shaders (vertex + fragment shader)
    function getShader(gl, id) {
	//gets the shader scripts (vertex + fragment)
        var shaderScript = document.getElementById(id);
        if (!shaderScript) {
            return null;
        }

        var str = "";
        var k = shaderScript.firstChild;
        while (k) {
            if (k.nodeType == 3) {
                str += k.textContent;
            }
            k = k.nextSibling;
        }

        var shader;
		//create shaders
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;
        }

		//ask WebGL to compile shaders
		//we check for errors here too
		//all errors are visible in the console (F12 in Google chrome)
        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert(gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }


	
    var shaderProgram;

	//Creates a program from a vertex + fragment shader pair
    function initShaders() {
        var fragmentShader = getShader(gl, "shader-fs");
        var vertexShader = getShader(gl, "shader-vs");

        shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
		//link the compiled binaries
        gl.linkProgram(shaderProgram);

		//check for errors, again
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
        }

		//activate current program
		//this sandbox has only on shader pair
		//we can have as many as we wish in more complex applications
        gl.useProgram(shaderProgram);

		//Update attributes for the vertex shader
		//attributes are accessible only from the vertex shader
		//if we want accessible data from a fragment shader we can use uniform variables,
		//or varyings that will be forwarded from the vertex shader to the fragment shader
		
		//Vertex position data
        shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

		//Vertex color data
        shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
        gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

		//Update uniform variables
		//this variables can be accessed from both the vertex and fragment shader
        shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
        shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    }


	//ModelView and Projection matrices
	//mat4 comes from the external library
    var mvMatrix = mat4.create();
    var mvMatrixStack = [];
    var pMatrix = mat4.create();

	//The matrix stack operation are implemented below to handle local transformations
	
	//Push Matrix Operation
    function mvPushMatrix() {
        var copy = mat4.create();
        mat4.set(mvMatrix, copy);
        mvMatrixStack.push(copy);
    }

	//Pop Matrix Operation
    function mvPopMatrix() {
        if (mvMatrixStack.length == 0) {
            throw "Invalid popMatrix!";
        }
        mvMatrix = mvMatrixStack.pop();
    }


	//Sets + Updates matrix uniforms
    function setMatrixUniforms() {
        gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
        gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    }


	//Rotation function helper
	function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }


	//Vertex, Index and Color Data
    var cubeVertexPositionBuffer; // contains coordinates
    var cubeVertexColorBuffer; //contains color per vertex
    var cubeVertexIndexBuffer; //contains indices for chains of vertices to draw triangles/other geometry

	//Initialize VBOs, IBOs and color
    function initBuffers() {
        //Vertex Buffer Object
        cubeVertexPositionBuffer = gl.createBuffer();
		//Bind buffer to ARRAY_BUFFER
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        vertices = [
            // Front face
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0, -1.0, -1.0,

            // Top face
            -1.0,  1.0, -1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0,  1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
             1.0, -1.0, -1.0,
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,

            // Right face
             1.0, -1.0, -1.0,
             1.0,  1.0, -1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0,  1.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0, -1.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		//every item has 3 coordinates (x,y,z)
        cubeVertexPositionBuffer.itemSize = 3;
		//we have 24 vertices
        cubeVertexPositionBuffer.numItems = 24;

		//Color
        cubeVertexColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexColorBuffer);
        colors = [
            [3.0, 0.0, 1.0, 2.0], // Front face
            [3.0, 1.0, 2.0, 1.0], // Back face
            [1.0, 1.0, 0.0, 1.0], // Top face
            [1.0, 0.5, 0.0, 1.0], // Bottom face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [0.0, 0.0, 1.0, 1.0]  // Left face
        ];
        var unpackedColors = [];
        for (var i in colors) {
            var color = colors[i];
			//assign colors for each vertex of each face based on the packed representation above
            for (var j=0; j < 4; j++) {
                unpackedColors = unpackedColors.concat(color);
            }
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedColors), gl.STATIC_DRAW);
		//every color has 4 values: red, green, blue and alpha (transparency: use 1.0 (opaque) for this demo)
        cubeVertexColorBuffer.itemSize = 4;
		//24 color values (we have 24 vertices to color...)
        cubeVertexColorBuffer.numItems = 24;

		//Index Buffer Object
		//it joins sets of vertices into faces
        cubeVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        var cubeVertexIndices = [
		//this numbers are positions in the VBO array above
            0, 1, 2,      0, 2, 3,    // Front face
            4, 5, 6,      4, 6, 7,    // Back face
            8, 9, 10,     8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15, // Bottom face
            16, 17, 18,   16, 18, 19, // Right face
            20, 21, 22,   20, 22, 23  // Left face
        ];
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
        //we have one item - the cube
		cubeVertexIndexBuffer.itemSize = 1;
		//we have 36 indices (6 faces, every face has 2 triangles, each triangle 3 vertices: 2x3x6=36)
        cubeVertexIndexBuffer.numItems = 36;
    }

	//Helper Variables
	
	//_________________________________________Member Variables______________________________________________//
    var rCube = 2; 
	var xTrans = 0.0;
	var yTrans = 0.0;
	var up_down=1;
	var swinging = 0.01;
	var Arm_1=0;
	var metritis=1;
	var counter1=0;
	var movDirection = true;
	var rotateScene=0;
	//________________________________________________________________________________________________________
	
	//array for keeping pressed keys
	var currentlyPressedKeys = {};

	//Keyboard handler
	//do not touch :) 
    function handleKeyDown(event) {
        currentlyPressedKeys[event.keyCode] = true;

        if (String.fromCharCode(event.keyCode) == "F") {
            filter += 1;
            if (filter == 3) {
                filter = 0;
            }
        }
    }


	//Keyboard handler
	//do not touch :) 
    function handleKeyUp(event) {
        currentlyPressedKeys[event.keyCode] = false;
    }

	//Key pressed callback
	//37-40 are the codes for the arrow keys
	//xTrans + yTrans are used in the ModelView matrix for local transformation of the cube
    function handleKeys() {
        if (currentlyPressedKeys[37]) {
 // Left cursor key
            xTrans -= 0.1; //Transformation
//The following code is written to rotate robot's arm 45 degrees step by step
		 if(Arm_1*20>=45.0) up_down=0;//Arm_1 counts down until the arms rotate +45 degrees from the Z axis 
		 else if (Arm_1*20<=-45.0) up_down=1;  //Arm_1 counts down until the arms rotate -45 degrees from the z-axis 
// Conclusively such a increase/decrease of degrees needs counter(+/-0.2 degrees per frame)
		 if(up_down==1) Arm_1+=0.2;
		 else Arm_1-=0.2;
		 
//When the user press the left cursor key ,a rotation of full scene will be take part (180 degrees from the y-axis)
//Robot goes left
			rotateScene=1;
		
			
        }
        if (currentlyPressedKeys[39]) {
      // Right cursor key
			xTrans += 0.1;
		
	//The following code is written to rotate robot's arm 45 degrees step by step
		if(Arm_1*20>=45.0) up_down=0; //Arm_1 counts down until the arms rotate +45 degrees from the y axis 
		else if (Arm_1*20<=-45.0) up_down=1;//Arm_1 counts down until the arms rotate -45 degrees from the z-axis 
		   
	// Conclusively such a increase/decrease of degrees needs counter(+/-0.2 degrees per frame)
		if(up_down==1) Arm_1+=0.2;
		else Arm_1-=0.2;
	//When the user press the left cursor key ,a rotation of full scene will be take part.The scence returns to initial view of Robot
	//Robot goes ahead -->	   
		   rotateScene=0;
        }
		
	//Transformation on y -axis		
		
        if (currentlyPressedKeys[38]) {
            // Up cursor key
            yTrans += 0.1;
        }
        if (currentlyPressedKeys[40]) {
            // Down cursor key
            yTrans -= 0.1;
        }
    }
	
//BindBuffers= sent packages to GPU ,witch include information about vertexes and shaders	
//The following procedure the the only way to inform GPU about vertexes and colors

	function BindBuffers(){
	
		
		//we bind the buffer for the cube vertices
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		//we bind the buffer for the cube colors
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexColorBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, cubeVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
		//we bind the buffer for the cube vertex indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
		/********************************************************************/
		//we update the uniforms for the shaders
        setMatrixUniforms();
		//we call the Draw Call of WebGL to draw the cube
		//Triangles mode
        gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
	
	
	}
	    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

	
	//For every frame this function draws the complete scene from the beginning
    function drawScene() {
	//the viewport gets the canvas values (that were assigned to the gl context variable)
        gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		//the frame and depth buffers get cleaned (the depth buffer is used for sorting fragments)
		//without the depth buffer WebGL does not know which fragment is visible for a given pixel
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		
		//aspect ratio gl.viewportWidth / gl.viewportHeight
		//near plane: 0.1 , far plane: 100
        mat4.perspective(60, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

		//the modelview Matrix is initialized with the Identity Matrix
        mat4.identity(mvMatrix);
			
		//REMEMBER there is no actual camera in WebGL
		mat4.translate(mvMatrix, [0.0, 0.0, -20.0]);
		
		//***********************Global Tranfrormations/Rotation of Scene************************//
		//When Robot walk  occurs a global Transformation of the Scene.
		//As a result we move at each frame the axis System
		//The same thing take part after global rotation(Rotate the axis system)
		
		mat4.rotate(mvMatrix, degToRad(180*rotateScene), [0 ,1 ,0]);
		mat4.translate(mvMatrix, [(2*(8-xTrans)*rotateScene), 0, 0.0]);
	
				
		//***********************Local Tranfrormations/Rotation of Scene***************************//

		mat4.translate(mvMatrix, [xTrans, yTrans, 0.0]);
		//____________Robot's Head _________________________//
		mvPushMatrix(); //push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8, 0, 0]);//Translate the cude  left
		BindBuffers();//draw the head
        mvPopMatrix(); //pop the axis system,because we want them for a next draw


		//_____________Robot's Solder_______________________//
		mvPushMatrix();//push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8, -4, 0]);//Tranlate -8 on x and -4 on y to intergrate the solder with head
		mat4.scale(mvMatrix, [0.55, 4, 0.6]);//scale to simulate a vertical rectangle solder
	    BindBuffers();//draw the head
	    mvPopMatrix();//pop the axis system,because we want them for a next draw
		
		
		//_________________Arm_1_______________________//
		mvPushMatrix();//push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8.2, -2, 0]);//Tranlate -8 on x and -4 on y to intergrate the arm 1 with head
		mat4.rotate(mvMatrix, degToRad(Arm_1*12), [0, 0, 1]); //local rotation of arm ,that is controlled by  member variable Arm_1
		mat4.scale(mvMatrix, [0.2, 2, 0.6]); // we are scaling the cube in order to design a real hand 
		mat4.translate(mvMatrix, [0, -1, 0]);
		BindBuffers();
		mvPopMatrix();
		//_________________Arm_2_______________________//
		mvPushMatrix();//push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8, -2, -1]);//Tranlate -8 on x and -4 on y to intergrate the arm 1 with head (-1 on z because we want the hand seems to be a little bit deepth )
		mat4.rotate(mvMatrix, degToRad(-1*Arm_1*8), [0, 0, 1]);//local rotation of arm ,that is controlled by  member variable Arm_1(The opposite rotation of Arm_1)
		mat4.scale(mvMatrix, [0.2, 2, 0.6]); // we are scaling the cube in order to design a real hand 
		mat4.translate(mvMatrix, [0, -1, 0]);
		BindBuffers();//draw
		mvPopMatrix();//pop the axis system,because we want them for a next draw
		//
		//Legs some procedure as Arms
		//_________________Leg_1_______________________//
		mvPushMatrix();//push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8, -7, 0]);
		mat4.rotate(mvMatrix, degToRad(Arm_1*10), [0, 0, 1]);
		mat4.scale(mvMatrix, [0.2, 2, 0.6]);
		mat4.translate(mvMatrix, [0, -1, 0]);
		BindBuffers();//draw
		mvPopMatrix();//pop the axis system,because we want them for a next draw
				//_________________Leg_2_______________________//
		mvPushMatrix();//push the axis system to a stack in order to remember the initial position of the axis.
		mat4.translate(mvMatrix, [-8, -7, -1.2]);
		mat4.rotate(mvMatrix, degToRad(-1*Arm_1*10), [0, 0, 1]);
		mat4.scale(mvMatrix, [0.2, 2, 0.6]);
		mat4.translate(mvMatrix, [0, -1, 0]);
		BindBuffers();//draw
		mvPopMatrix();//pop the axis system,because we want them for a next draw
		
    }

	//animation parameter
    var lastTime = 0;

	var counter = 0.0;
	//Animate function
    function animate() {
        var timeNow = new Date().getTime();
        if (lastTime != 0) {
            var elapsed = timeNow - lastTime;

			//adjust a constant rotation speed independently of platform/framerate
            rCube -= (275 * elapsed) / 1000.0;
			
			counter += elapsed;
			if (counter > 1000.0){
				movDirection = !movDirection;
				counter = 0;
				}
			if (movDirection)
				swinging += (1 * elapsed) / 1000.0;
			else 
				swinging -= (1 * elapsed) / 1000.0;
				
			
        }
        lastTime = timeNow;
    }


	//this is the requestAnimFrame callback
	//For every tick, request another frame
	//handle keyboard, draw the scene, animate (update animation variebles) and continue
    function tick() {
        requestAnimFrame(tick);
		handleKeys();
        drawScene();
      //  animate();
				
    }

	//Entry point of the WebGL context
	function webGLStart() {
        var canvas = document.getElementById("TUCWebGL");
        
		//Functions for initialization
		//Check above
		initGL(canvas);
        initShaders();
        initBuffers();

		//Background Color: Color assigned for all pixels with no corresponding fragments
        gl.clearColor(0.9, 0.6, 0.5, 3.0);
		
		//Enable z-buffer for depth sorting
        gl.enable(gl.DEPTH_TEST);

		//define the keyboard handlers
		document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;
		
		//the first tick of our application
        tick();
    }
//end of Javascript
</script>

</head>

<!-- HMTL for the canvas element-->
<body onload="webGLStart();"> <!-- calls the entry point of our application -->

    <canvas id="TUCWebGL" style="border: none;" width="500" height="500"></canvas>

    <br>

</body></html>