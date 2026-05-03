select c.title as challenge, c.status, c.publish_at,
       t.title as task, t.target_count, t.points
from challenges c
left join tasks t on t.challenge_id = c.id and t.deleted_at is null
where c.title like 'Shot practice%'
order by c.created_at desc limit 5;