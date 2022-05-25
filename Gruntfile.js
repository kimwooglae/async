module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    concat: {
      options: {
        separator: ";",
      },
      dist: {
        src: ["src/*.js"],
        dest: "dist/<%= pkg.name %>.js",
      },
    },
    clean: {
      dist: ["dist/<%= pkg.name %>.js"],
    },
    uglify: {
      options: {
        banner: '/* <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd hh:MM:ss") %> */\n',
        sourceMap: true,
      },
      dist: {
        files: {
          "dist/<%= pkg.name %>.min.js": ["<%= concat.dist.dest %>"],
        },
      },
    },
    jshint: {
      files: ["Gruntfile.js", "lib/**/*.js"],
      options: {
        // options here to override JSHint defaults
        curly: true,
        eqeqeq: true,
        eqnull: true,
        browser: true,
        esversion: 6,
        globals: {
          console: true,
        },
      },
    },
    jsdoc: {
      dist: {
        src: ["src/*.js"],
        options: {
          destination: "doc",
        },
      },
    },
  });

  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-contrib-concat");
  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-jsdoc");

  grunt.registerTask("test", ["jshint"]);
  grunt.registerTask("build_with_jshint", ["jshint", "concat", "uglify"]);
  grunt.registerTask("default", ["jshint", "jsdoc", "concat", "uglify", "clean"]);
};
