import { Request, Response } from 'express';
import fs from 'fs';
import { jsPDF } from 'jspdf';
import path from 'path';
import dayjs from 'dayjs';

export type SemesterScheduleTerm = {
	name: string;
	id: string;
	start: string;
	finish: string;
	rooms: string;
};

type Course = {
	start: Date;
	finish: Date;
	name: string;
};

export type SemesterScheduleYearPlanTerms = {
	id: string;
	start: string;
	finish: string;
	dayOfWeek?: number;
	whichWeek?: number;
};

type RenderCourse = Pick<Course, 'start' | 'finish' | 'name'>;

export interface RenderData {
	terms: Pick<SemesterScheduleTerm, 'name' | 'id' | 'start' | 'finish' | 'rooms'>[];
	course: RenderCourse;
	yearPlanTerms: SemesterScheduleYearPlanTerms[];
}

interface Lesson {
	name: string;
	startTime: string;
	endTime: string;
	dayOfWeek: number;
	whichWeek: number;
	start: string;
	finish: string;
	roomName: string;
}

function parseDates(data: any): { startDate: string; endDate: string } {
	if (!data || !data.terms || !Array.isArray(data.terms) || data.terms.length === 0) {
		console.error('Invalid date data provided');
		return { startDate: '', endDate: '' };
	}

	const dates = [
		...data.terms.map((course: any) => course.start),
		...data.terms.map((course: any) => course.finish),
	];

	if (dates.length === 0) {
		console.error('No valid dates found');
		return { startDate: '', endDate: '' };
	}

	const sortedDates = dates.sort();
	return {
		startDate: sortedDates[0],
		endDate: sortedDates[sortedDates.length - 1],
	};
}

async function getTerms(terms: SemesterScheduleTerm[]) {
	if (!terms.length) {
		console.error('Invalid course data provided');
		return { courses: [], minHour: 24, maxHour: 0 };
	}
	const startDate = new Date(terms[0].start);

	let minHour = 24;
	let maxHour = 0;

	const courses = terms.map((term): Lesson => {
		const courseStartDate = new Date(term.start);
		const adjustedStartDate = new Date(courseStartDate);
		if (adjustedStartDate.getDay() !== 0) {
			adjustedStartDate.setDate(
				adjustedStartDate.getDate() + ((7 - adjustedStartDate.getDay()) % 7)
			);
		}
		const whichWeek =
			Math.ceil((adjustedStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)) +
			1;

		const startHour = parseInt(String(term.start).split('T')[1].split(':')[0]);
		const finishHour =
			parseInt(String(term.finish).split('T')[1].split(':')[0]) +
			(new Date(term.finish).getTime() % 3600000 > 0 ? 1 : 0);

		minHour = Math.min(minHour, startHour);
		maxHour = Math.max(maxHour, finishHour);

		return {
			name: term.name,
			startTime: term.start,
			endTime: term.finish,
			dayOfWeek: dayjs(term.start).day() === 0 ? 7 : dayjs(term.start).day(),
			whichWeek: whichWeek - 1,
			start: term.start,
			finish: term.finish,
			roomName: term.rooms,
		};
	});

	return { courses, minHour, maxHour };
}

export async function renderSemesterPlan(req: Request, res: Response, data: RenderData) {
	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4',
	});

	const { startDate, endDate } = parseDates(data);

	const courseData = await getTerms(data.terms);
	const lessons = courseData.courses;
	const minHour = courseData.minHour;
	const maxHour = courseData.maxHour;
	const courseInfo = data.course;
	const yearPlanTerms = data.yearPlanTerms;

	generateTimetable(doc, startDate, endDate, lessons, courseInfo, minHour, maxHour, yearPlanTerms);

	const pdfBuffer = doc.output('arraybuffer');
	const filePath = path.join(__dirname, 'semester-schedule.pdf');
	fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

	res.contentType('application/pdf');
	res.sendFile(filePath);
}

function generateTimetable(
	doc: jsPDF,
	startDate: string,
	endDate: string,
	lessons: Lesson[],
	courseInfo: RenderCourse,
	minHour: number,
	maxHour: number,
	yearPlanTerms: SemesterScheduleYearPlanTerms[]
): void {
	const pageWidth = doc.internal.pageSize.width;
	const pageHeight = doc.internal.pageSize.height;

	const timesPerday = maxHour - minHour;
	const numOfWeeks = Math.max(...lessons.map((lesson) => lesson.whichWeek));
	const margin = 15;
	const cellWidth = (pageWidth - 2 * margin) / numOfWeeks;
	const cellHeight = 30;
	const startX = margin;
	const startY = 15;
	const daysOfWeek = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
	const timeSlots = Array.from({ length: timesPerday }, (_, i) => `${minHour + i}`);

	daysOfWeek.forEach((day, dayIndex) => {
		const dayY = startY + dayIndex * cellHeight;

		doc.setFontSize(7);
		doc.setFont('Helvetica', 'bold');
		doc.text(day, 2, dayY + cellHeight / 2);

		doc.line(startX, dayY - 2, startX + numOfWeeks * cellWidth, dayY - 2);
		doc.line(startX, dayY, startX + numOfWeeks * cellWidth, dayY);
		doc.line(startX, dayY + 27, startX + numOfWeeks * cellWidth, dayY + 27);

		for (let week = 0; week <= numOfWeeks; week++) {
			doc.line(startX + week * cellWidth, dayY - 2, startX + week * cellWidth, dayY + 27);
		}

		doc.setFontSize(4);
		doc.setFont('Helvetica');
		const start = new Date(startDate);
		start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));

		const end = new Date(endDate);
		end.setDate(end.getDate() + (end.getDay() === 0 ? 0 : 6 - end.getDay()));

		const dateArray = [];
		for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
			if (dt.getDay() !== 0) {
				const formattedDate = `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
				dateArray.push(formattedDate);
			}
		}
		for (let week = 0; week <= numOfWeeks - 1; week++) {
			const dateIndex = dayIndex + week * 6;
			if (dateIndex < dateArray.length) {
				doc.text(dateArray[dateIndex], startX + 0.5 + week * cellWidth, dayY - 0.5);
			}
		}

		doc.setDrawColor(150, 150, 150);
		(doc as any).setLineDash([1, 1], 0);
		for (let x = 1; x < timesPerday; x++) {
			doc.line(
				startX,
				dayY + (27 / timesPerday) * x,
				startX + numOfWeeks * cellWidth,
				dayY + (27 / timesPerday) * x
			);
		}
		(doc as any).setLineDash([]);
		doc.setDrawColor(0, 0, 0);

		doc.setFontSize(5);
		doc.setFont('Helvetica');
		const padding = 27 / (timesPerday + 10);
		timeSlots.forEach((timeSlot, index) => {
			doc.text(timeSlot, 13, dayY + (27 / timesPerday) * index + padding, { align: 'right' });
		});
		timeSlots.forEach((timeSlot, index) => {
			doc.text(
				timeSlot,
				startX + numOfWeeks * cellWidth + 2,
				dayY + (27 / timesPerday) * index + padding
			);
		});
	});

	// Calculate the nearest Monday before or on startDate
	const start = new Date(startDate);
	start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));

	// Calculate the nearest Saturday after or on endDate
	const end = new Date(endDate);
	end.setDate(end.getDate() + (end.getDay() === 0 ? 0 : 6 - end.getDay()));

	drawHolidays(
		doc,
		yearPlanTerms,
		startX,
		startY,
		cellWidth,
		cellHeight,
		timesPerday,
		minHour,
		maxHour,
		start,
		end
	);
	drawLessons(doc, lessons, startX, startY, cellWidth, cellHeight, timesPerday, minHour);
	drawFooter(doc, courseInfo, pageHeight);
}
function drawHolidays(
	doc: jsPDF,
	yearPlanTerms: SemesterScheduleYearPlanTerms[],
	startX: number,
	startY: number,
	cellWidth: number,
	cellHeight: number,
	timesPerday: number,
	minHour: number,
	maxHour: number,
	start: Date,
	end: Date
) {
	const separatedTerms = yearPlanTerms.flatMap((term) => {
		const termStart = new Date(term.start);
		const termEnd = new Date(term.finish);
		const days: any[] = [];

		let currentDate = new Date(termStart);
		while (currentDate <= termEnd) {
			const nextDate = new Date(currentDate);
			nextDate.setDate(nextDate.getDate() + 1);

			const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
			const whichWeek = Math.ceil(
				(currentDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
			);

			if (whichWeek >= 1 && dayOfWeek !== 7) {
				days.push({
					start: new Date(currentDate.setHours(minHour, 0, 0, 0)),
					finish: new Date(currentDate.setHours(maxHour, 0, 0, 0)),
					dayOfWeek: dayOfWeek,
					whichWeek: whichWeek,
				});
			}

			currentDate = nextDate;
		}

		return days;
	});

	separatedTerms.forEach(({ start, finish, dayOfWeek, whichWeek }) => {
		if (start >= start && finish <= end) {
			const x = startX + (whichWeek - 1) * cellWidth;
			const y = startY + (dayOfWeek - 1) * cellHeight;
			const height = 27; // Full cell height

			doc.setFillColor(255, 200, 200);
			doc.setDrawColor(0, 0, 0); // Set border color to black
			doc.rect(x, y, cellWidth, height, 'FD'); // 'FD' means fill and draw (border)
		}
	});
}

function drawLessons(
	doc: jsPDF,
	lessons: Lesson[],
	startX: number,
	startY: number,
	cellWidth: number,
	cellHeight: number,
	timesPerday: number,
	minHour: number
) {
	lessons.forEach((lesson: any) => {
		const startTime = new Date(lesson.start);
		const finishTime = new Date(lesson.finish);
		const x = startX + (lesson.whichWeek - 1) * cellWidth;
		const durationHours = (finishTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

		const yStart =
			startY +
			(lesson.dayOfWeek - 1) * cellHeight +
			(parseInt(String(lesson.start).split('T')[1].split(':')[0]) - minHour) * (27 / timesPerday);
		// console.log('test:', x, yStart, cellWidth, durationHours);
		// console.log('lessonstart', lesson.start);
		// console.log('minHour', minHour);
		// console.log('timesPerday', timesPerday);
		const height = (27 / timesPerday) * durationHours;

		doc.setFillColor(255, 255, 100);
		doc.setDrawColor(0, 0, 0);
		doc.setFontSize(5);

		if (!isNaN(x) && !isNaN(yStart) && !isNaN(cellWidth) && !isNaN(height)) {
			doc.rect(x + 1, yStart, cellWidth - 1, height, 'FD');
		} else {
			console.log('Invalid data', x, yStart, cellWidth, height);
		}
		doc.text(lesson.name.substring(0, 3), x + 2, yStart + 2);
		if (height > 5) doc.text(lesson.roomName, x + 2, yStart + 5);
		else doc.text(lesson.roomName, x + doc.getTextWidth(lesson.name) + 2, yStart + 2);
	});
}

function drawFooter(doc: jsPDF, course: RenderCourse, pageHeight: number) {
	doc.setFontSize(10);
	const today = new Date();
	const formattedStartDate = dayjs(course.start).format('DD.MM.YYYY');
	const formattedEndDate = dayjs(course.finish).format('DD.MM.YYYY');
	const dateText = `${formattedStartDate} - ${formattedEndDate}`;
	const printedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;

	const footerParts = [
		{ label: 'Kurs: ', value: course.name },
		{ label: 'Klasse: ', value: 'HF ET 23F-26F 1. Sem Klasse A' },
		{ label: 'Zeitraum: ', value: dateText },
		{ label: 'Gedruckt: ', value: printedDate },
	];

	const startX = 15;
	let currentX = startX;
	const y = pageHeight - 10;

	footerParts.forEach((part, index) => {
		doc.setFont('Helvetica', 'bold');
		doc.text(part.label, currentX, y);
		currentX += doc.getTextWidth(part.label);

		doc.setFont('Helvetica', 'normal');
		doc.text(part.value, currentX, y);
		currentX += doc.getTextWidth(part.value);

		if (index < footerParts.length - 1) {
			doc.text(' // ', currentX, y);
			currentX += doc.getTextWidth(' // ');
		}
	});
}
