/*
    TODO -  Separate network lobby screen (separate some of the joining/network logic from this)
*/

game.playScreen = me.ScreenObject.extend({

    onResetEvent : function () {
        // Set up loader callback
        me.game.onLevelLoaded = this.onLevelLoaded.bind(this);

        // Load our level
        me.levelDirector.loadLevel("main");

        // Load the HUD
        me.game.addHUD(0, 0, global.WIDTH, 20, "rgba(0, 0, 0, 0.5)");
        me.game.HUD.addItem("latency", new game.Info(10, 5, "latency"));
        me.game.HUD.addItem("connected", new game.Info(100, 5, "connected players"));

        // Helper function to return one of our remote players
        playerById = function(id) {
            var i;

            for (i = 0; i < global.state.remotePlayers.length; i++) {
                if (global.state.remotePlayers[i].id == id)
                    return global.state.remotePlayers[i];
            };

            return false;
        };
    },

    onLevelLoaded : function (name) {
        console.log("[+] onLevelLoaded:");
        // Fade out
        me.game.viewport.fadeOut("#000", 500);

        // Create our player and set them to be the local player (so we know who "we" are)
        global.state.localPlayer = new game.Player(40, 190, {
            spritewidth: 50,
            spriteheight: 30,
            name: "player"
        });
        global.state.localPlayer.id = "player";

        me.game.add(global.state.localPlayer, 4);
        me.game.sort();

        // Connect to the game server
        socket = io.connect("http://localhost", {port: 8000, transports: ["websocket"]});
        // and set up our networking callbacks
        socket.on("connect", this.onSocketConnected);
        socket.on("new player", this.onNewPlayer);
        socket.on("move player", this.onMovePlayer);
        socket.on("remove player", this.onRemovePlayer);
        socket.on("error", this.handleError);
        socket.on("pong", this.updateLatency);
    },

    // For error debugging
    handleError: function(error){
        console.log(error);
    },

    onDestroyEvent: function () {
        // Unbind keys
        me.input.unbindKey(me.input.KEY.LEFT);
        me.input.unbindKey(me.input.KEY.RIGHT);
        me.input.unbindKey(me.input.KEY.UP);
        me.input.unbindKey(me.input.KEY.DOWN);
    },

    onSocketConnected: function() {
        console.log("Connected to socket server");
        // When we connect, tell the server we have a new player (us)
        socket.emit("new player", {x: global.state.localPlayer.pos.x, y: global.state.localPlayer.pos.y})

        // Set up ping / pongs for latency
        setInterval(function () {
            global.network.emitTime = +new Date;
            global.network.emits++;
            socket.emit('ping');
        }, 500);
    },

    updateLatency: function() {
        // Simply updates the average latency
        global.network.latency = (( global.network.latency + (+new Date - global.network.emitTime))/global.network.emits);
        me.game.HUD.setItemValue("latency", global.state.latency);
    },

    onNewPlayer: function(data) {
        // When a new player connects, we create their object and add them to the screen.
        var newPlayer = new game.Player(data.x, data.y, {
            spritewidth: 50,
            spriteheight: 30,
            name: "o"
        });
        newPlayer.id = data.id;
        newPlayer.name = data.name;

        global.state.remotePlayers.push(newPlayer);

        me.game.add(newPlayer, 3);
        me.game.sort(game.sort);

        // Update the HUD with the new number of players
        me.game.HUD.setItemValue("connected", global.state.remotePlayers.length);
    },

    onRemovePlayer: function(data) {
        // When a player disconnects, we find them in our remote players array
        var removePlayer = playerById(data.id);

        if(!removePlayer) {
            console.log("Player not found "+data.id);
            return;
        };

        // and remove them from the screen
        me.game.remove(removePlayer);
        me.game.sort();
        global.state.remotePlayers.splice(global.state.remotePlayers.indexOf(removePlayer), 1);

        // and update the HUD
        me.game.HUD.setItemValue("connected", global.state.remotePlayers.length);
    },

    onMovePlayer: function(data) {
        // When a player moves, we get that players object
        var movePlayer = playerById(data.id);

        // if it isn't us, or we can't find it (bad!)
        if(!movePlayer || movePlayer.name === 'player') {
            return;
        }

        // update the players position locally
        movePlayer.pos.x = data.x;
        movePlayer.pos.y = data.y;
    }
});