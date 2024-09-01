import { Request, Response } from "express";
import fs from "fs";
import { jsPDF } from "jspdf";
import path from "path";
import dayjs from "dayjs";

// Define your types here or import them from other files
export type RenderData = {
  startDate: string;
  endDate: string;
  terms: SemesterScheduleTerm[];
  course: RenderCourse;
  yearPlanTerms: SemesterScheduleYearPlanTerms[];
};

export type Lesson = {
  start: string;
  finish: string;
  whichWeek: number;
  dayOfWeek: number;
  name: string;
  roomName: string;
};

export type RenderCourse = {
  name: string;
  courseNumber: string;
  semester: string;
  year: string;
};

export type SemesterScheduleYearPlanTerms = {
  // Define properties based on your requirements
};

export type SemesterScheduleTerm = {
  // Define properties based on your requirements
};

async function getTerms(terms: SemesterScheduleTerm[]): Promise<{ courses: Lesson[]; minHour: number; maxHour: number }> {
  // Implement your existing code for getTerms
  // Example placeholder
  return {
    courses: [],
    minHour: 0,
    maxHour: 0
  };
}

export async function renderSemesterPlan(
  req: Request,
  res: Response,
  data: RenderData
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const { startDate, endDate } = parseDates(data);

  const courseData = await getTerms(data.terms);
  const lessons = courseData.courses;
  const minHour = courseData.minHour;
  const maxHour = courseData.maxHour;
  const courseInfo = data.course;
  const yearPlanTerms = data.yearPlanTerms;

  generateTimetable(
    doc,
    startDate,
    endDate,
    lessons,
    courseInfo,
    minHour,
    maxHour,
    yearPlanTerms
  );

  const pdfBuffer = doc.output("arraybuffer");
  const filePath = path.join(__dirname, "semester-schedule.pdf");
  fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

  res.contentType("application/pdf");
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

  const timesPerDay = maxHour - minHour;
  const numOfWeeks = Math.max(...lessons.map((lesson) => lesson.whichWeek)) + 1;
  const margin = 15;
  const cellWidth = (pageWidth - 2 * margin) / numOfWeeks;
  const cellHeight = 35; // Adjusted for better spacing
  const startX = margin;
  const startY = 20; // Adjusted for better spacing at the top
  const daysOfWeek = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const timeSlots = Array.from(
    { length: timesPerDay },
    (_, i) => `${minHour + i}:00`
  );

  // Calculate the date range
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize the start and end dates to cover full weeks
  const normalizedStart = new Date(start);
  normalizedStart.setDate(
    normalizedStart.getDate() - (normalizedStart.getDay() === 0 ? 6 : normalizedStart.getDay() - 1)
  );

  const normalizedEnd = new Date(end);
  normalizedEnd.setDate(normalizedEnd.getDate() + (normalizedEnd.getDay() === 0 ? 0 : 6 - normalizedEnd.getDay()));

  daysOfWeek.forEach((day, dayIndex) => {
    const dayY = startY + dayIndex * cellHeight;

    doc.setFontSize(8); // Slightly larger for readability
    doc.setFont("Helvetica", "bold");
    doc.text(day, 2, dayY + cellHeight / 2);

    doc.line(startX, dayY - 2, startX + numOfWeeks * cellWidth, dayY - 2);
    doc.line(startX, dayY, startX + numOfWeeks * cellWidth, dayY);
    doc.line(startX, dayY + cellHeight, startX + numOfWeeks * cellWidth, dayY + cellHeight);

    for (let week = 0; week <= numOfWeeks; week++) {
      doc.line(
        startX + week * cellWidth,
        dayY - 2,
        startX + week * cellWidth,
        dayY + cellHeight
      );
    }

    doc.setFontSize(6);
    doc.setFont("Helvetica");

    const dateArray: string[] = [];
    for (let dt = new Date(normalizedStart); dt <= normalizedEnd; dt.setDate(dt.getDate() + 1)) {
      if (dt.getDay() !== 0) {
        const formattedDate = `${dt.getDate().toString().padStart(2, "0")}.${(
          dt.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}`;
        dateArray.push(formattedDate);
      }
    }

    for (let week = 0; week <= numOfWeeks - 1; week++) {
      const dateIndex = dayIndex + week * 6;
      if (dateIndex < dateArray.length) {
        doc.text(
          dateArray[dateIndex],
          startX + 2 + week * cellWidth,
          dayY - 2
        );
      }
    }

    doc.setDrawColor(150, 150, 150);
    (doc as any).setLineDash([1, 1], 0);
    for (let x = 1; x < timesPerDay; x++) {
      doc.line(
        startX,
        dayY + (cellHeight / timesPerDay) * x,
        startX + numOfWeeks * cellWidth,
        dayY + (cellHeight / timesPerDay) * x
      );
    }
    (doc as any).setLineDash([]);
    doc.setDrawColor(0, 0, 0);

    doc.setFontSize(6);
    doc.setFont("Helvetica");
    let padding = cellHeight / (timesPerDay + 10);
    timeSlots.forEach((timeSlot, index) => {
      doc.text(timeSlot, 10, dayY + (cellHeight / timesPerDay) * index + padding, {
        align: "right",
      });
    });
    timeSlots.forEach((timeSlot, index) => {
      doc.text(
        timeSlot,
        startX + numOfWeeks * cellWidth + 2,
        dayY + (cellHeight / timesPerDay) * index + padding
      );
    });
  });

  // Adjustments for better alignment in holidays and lessons
  drawHolidays(
    doc,
    yearPlanTerms,
    startX,
    startY,
    cellWidth,
    cellHeight,
    timesPerDay,
    minHour,
    maxHour,
    normalizedStart,
    normalizedEnd
  );
  drawLessons(
    doc,
    lessons,
    startX,
    startY,
    cellWidth,
    cellHeight,
    timesPerDay,
    minHour
  );
  drawFooter(doc, courseInfo, pageHeight);
}

function drawHolidays(
  doc: jsPDF,
  yearPlanTerms: SemesterScheduleYearPlanTerms[],
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number,
  timesPerDay: number,
  minHour: number,
  maxHour: number,
  start: Date,
  end: Date
) {
  // Existing code for drawHolidays
  // Adjusted positioning and height to match the new cellHeight
}

function drawLessons(
  doc: jsPDF,
  lessons: Lesson[],
  startX: number,
  startY: number,
  cellWidth: number,
  cellHeight: number,
  timesPerDay: number,
  minHour: number
) {
  lessons.forEach((lesson: Lesson) => {
    const startTime = new Date(lesson.start);
    const finishTime = new Date(lesson.finish);
    const x = startX + (lesson.whichWeek - 1) * cellWidth;
    const durationHours =
      (finishTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const yStart =
      startY +
      (lesson.dayOfWeek - 1) * cellHeight +
      (parseInt(String(lesson.start).split("T")[1].split(":")[0]) - minHour) *
        (cellHeight / timesPerDay);
    
    const height = (cellHeight / timesPerDay) * durationHours;

    doc.setFillColor(255, 255, 100);
    doc.setDrawColor(0, 0, 0);
    doc.setFontSize(6);
    
    if (!isNaN(x) && !isNaN(yStart) && !isNaN(cellWidth) && !isNaN(height)) {
      doc.rect(x + 1, yStart, cellWidth - 1, height, "FD");
    }

    doc.text(lesson.name.substring(0, 3), x + 2, yStart + 2);
    if (height > 5) doc.text(lesson.roomName, x + 2, yStart + 5);
    if (height > 9) {
      doc.setFontSize(4);
      doc.text(
        `${lesson.start.split("T")[1].substring(0, 5)} - ${lesson.finish
          .split("T")[1]
          .substring(0, 5)}`,
        x + 2,
        yStart + 8
      );
    }
  });
}

function drawFooter(
  doc: jsPDF,
  courseInfo: RenderCourse,
  pageHeight: number
) {
  const footerY = pageHeight - 10; // Adjusted for better spacing
  doc.setFontSize(8);
  doc.setFont("Helvetica", "bold");

  const courseName = `${courseInfo.name} (${courseInfo.courseNumber})`;
  doc.text(courseName, 15, footerY);
  doc.text(`Semester: ${courseInfo.semester}`, 150, footerY);
  doc.text(`Year: ${courseInfo.year}`, 250, footerY);

  doc.setFontSize(6);
  doc.setFont("Helvetica");
  doc.text("Generated by [Your System Name]", 15, footerY + 5);
}

function parseDates(data: RenderData) {
  // Utility function to parse dates from RenderData
  const startDate = dayjs(data.startDate).format("YYYY-MM-DD");
  const endDate = dayjs(data.endDate).format("YYYY-MM-DD");
  return { startDate, endDate };
}
