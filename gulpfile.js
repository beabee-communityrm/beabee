const autoprefixer = require('autoprefixer');
const gulp = require('gulp');
const postcss = require('gulp-postcss');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const ts = require('gulp-typescript');

const tsProject = ts.createProject('./tsconfig.json');

function buildCSS() {
	return gulp.src('./static/scss/**/*.scss')
		.pipe(sourcemaps.init())
		.pipe(sass().on('error', sass.logError))
		.pipe(postcss([autoprefixer()]))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./built/static/css'));
}

function buildApp() {
	return tsProject.src()
		.pipe(tsProject())
		.js.pipe(gulp.dest('./built'));
}

function copyAppFiles() {
	return gulp.src([
		'./static/**/*',
		'./tools/**/*',
		'./src/**/*',
		'./apps/**/*',
		'!./**/*.ts'
	], {base: './'})
		.pipe(gulp.dest('./built/'));
}

const build = gulp.parallel(buildCSS, buildApp, copyAppFiles);

function watch() {
	gulp.watch('./static/scss/**/*.scss', buildCSS);
}

module.exports = {
	default: gulp.series(build, watch),
	build,
	watch
};
