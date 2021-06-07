Logical:      Employee
Title:        "MITRE Exmployee"
Description:  "Someone who works for MITRE"
* name 0..* SU HumanName "The employee's name" "A string of characters which identifies the person in written or verbal communication"
* birthDate 0..1 SU dateTime "The employee's birthday" "The day, month, and year in which the employee was born"

Logical:      Employee-PT 
Title:        "Part Time Employee"
Parent:       Employee
Description:  "Someone who works for MITRE part-time"