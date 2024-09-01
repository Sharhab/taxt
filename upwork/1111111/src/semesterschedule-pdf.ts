import { Request, Response } from 'express';
import fs from 'fs';
import { jsPDF } from 'jspdf';
import path from 'path';
import dayjs from 'dayjs';

// Type Definitions (unchanged)
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

// Helper Functions
function parseDates(data: any): { startDate: string; endDate: string } {
    // Parse dates and return the earliest and latest
    // Improved error handling and date parsing logic
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
    // Extract lessons and calculate min/max hours
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

// Main Rendering Function
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

    // Error handling during file operations
    try {
        fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
        res.contentType('application/pdf');
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Failed to generate PDF');
            }
        });
    } catch (error) {
        console.error('Error writing PDF to file:', error);
        res.status(500).send('Failed to generate PDF');
    }
}

// Drawing Functions
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
    // Logic to draw the timetable grid, lessons, and other info
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

        timeSlots.forEach((time, timeIndex) => {
            const timeX = startX + timeIndex * cellWidth;

            doc.setFontSize(7);
            doc.setFont('Helvetica', 'bold');
            doc.text(time, timeX, startY / 2);
            doc.line(timeX + cellWidth, dayY, timeX + cellWidth, dayY + numOfWeeks * cellHeight);
        });
    });

    lessons.forEach((lesson) => {
        const lessonY = startY + (lesson.dayOfWeek - 1) * cellHeight;
        const lessonX = startX + (lesson.whichWeek - 1) * cellWidth;
        const lessonHeight = cellHeight;
        const lessonWidth = 10;

        doc.setFillColor(100, 149, 237);
        doc.rect(lessonX, lessonY, lessonWidth, lessonHeight, 'F');
        doc.text(lesson.name, lessonX + lessonWidth / 2, lessonY + lessonHeight / 2);
    });

    doc.line(margin, startY, margin + numOfWeeks * cellWidth, startY);
    doc.line(margin, startY + daysOfWeek.length * cellHeight, margin + numOfWeeks * cellWidth, startY + daysOfWeek.length * cellHeight);
}
