const autoprefixer = require('autoprefixer');
const gulp = require('gulp');
const postcss = require('gulp-postcss');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');

const browserSync = require('browser-sync').create();

const paths = {
	css: {
		src: './static/scss/**/*.scss',
		dest: './built/static/css'
	},
	appFiles: {
		src: ['./src/**/*', './apps/**/*', './tools/**/*', '!./**/*.{js,ts}', './static/**/*', './config/**/*'],
		dest: './built'
	}
};

function buildCSS() {
	return gulp.src(paths.css.src)
		.pipe(sourcemaps.init())
		.pipe(sass().on('error', sass.logError))
		.pipe(postcss([autoprefixer()]))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(paths.css.dest))
		.pipe(browserSync.stream({match: './**/*.css'}));
}

function copyAppFiles() {
	return gulp.src(paths.appFiles.src, {base: './', since: gulp.lastRun(copyAppFiles)})
		.pipe(gulp.dest(paths.appFiles.dest));
}

const build = gulp.parallel(buildCSS, copyAppFiles);

function watch() {
	browserSync.init({
		proxy: 'http://localhost:3001'
	});

	gulp.watch(paths.css.src, buildCSS);
	gulp.watch(paths.appFiles.src, copyAppFiles);
}

module.exports = {
	default: gulp.series(build, watch),
	build,
	watch
};
