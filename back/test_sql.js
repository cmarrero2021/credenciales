require('dotenv').config();
const pool = require('./src/db');

async function run() {
    try {
        console.log("Testing history query...");
        const q1 = `
            WITH latest_attempts AS (
                SELECT DISTINCT ON (e.file_name) 
                       e.id, e.upload_id, e.file_name, e.cedula, e.reason, e.details, e.created_at, 
                       COALESCE(u.email, CAST(m.user_id AS TEXT)) AS user_id, m.total_files
                FROM mass_upload_errors e
                JOIN mass_uploads m ON e.upload_id = m.id
                LEFT JOIN users u ON m.user_id = u.id
                ORDER BY e.file_name, e.created_at DESC
            )
            SELECT * FROM latest_attempts
            ORDER BY created_at DESC
            LIMIT 10
        `;
        await pool.query(q1);
        console.log("History query OK.");
        
        console.log("Testing latest_db query...");
        const q2 = `
            SELECT m.id, COALESCE(u.email, CAST(m.user_id AS TEXT)) AS user_id, m.total_files, m.summary, m.created_at,
                   (SELECT json_agg(json_build_object('file', e.file_name, 'cedula', e.cedula, 'reason', e.reason, 'created_at', e.created_at) ORDER BY e.created_at DESC)
                    FROM mass_upload_errors e WHERE e.upload_id = m.id) AS errors
            FROM mass_uploads m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
            LIMIT 1
        `;
        await pool.query(q2);
        console.log("Latest_db query OK.");
        process.exit(0);
    } catch (err) {
        console.error("SQL ERROR:", err.message);
        process.exit(1);
    }
}
run();
